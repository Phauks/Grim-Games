import { expect, test, type Page } from '@playwright/test';
import { APP_NAME } from '../src/lib/core/app-name.ts';

const CHOOSER = 'https://github.com/Phauks/Grim-Games/issues/new/choose';

/** Fills the in-app Report form, sends it, and returns what reached the Worker. */
async function sendReport(page: Page): Promise<Record<string, string>> {
	const form = page.getByRole('dialog', { name: 'Report' });
	await expect(form).toBeVisible();
	const title = form.getByRole('textbox', { name: 'Title' });
	if (!(await title.inputValue())) await title.fill('Testing a report');
	await form.getByRole('textbox', { name: 'Description' }).fill('It broke while testing.');
	const [request] = await Promise.all([
		page.waitForRequest((r) => r.url().endsWith('/api/reports') && r.method() === 'POST'),
		form.getByRole('button', { name: 'Confirm' }).tap()
	]);
	await expect(form.getByTestId('report-sent')).toHaveText(/^Sent as report #\d+\.$/);
	const sent = request.postDataJSON();
	await form.getByRole('button', { name: 'Close' }).last().tap();
	return sent;
}

test('an uncaught error shows the corner card, and Details offers a scrubbed report', async ({
	page
}) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(APP_NAME);
	// Something nothing in the app catches, with a private-looking URL in its message.
	await page.evaluate(() =>
		setTimeout(() => {
			throw new Error('test failure at https://example.com/room?code=SECRET#script=abc');
		})
	);

	const card = page.getByTestId('error-notice');
	await expect(card).toBeVisible();
	await expect(card).toContainText('Something went wrong');
	const box = await card.boundingBox();
	const viewport = page.viewportSize();
	// Over the page in a corner, never pushing content.
	expect(await card.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
	expect(box!.width).toBeLessThanOrEqual(viewport!.width);

	await card.getByRole('button', { name: 'Details' }).tap();
	await expect(card).toBeHidden();
	const dialog = page.getByRole('dialog', { name: 'Problems on this device' });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('test failure at example.com/room');
	// A row opens that problem's details over the list.
	await dialog
		.getByTestId('problems')
		.getByRole('button', { name: /test failure/ })
		.tap();
	const details = page.getByRole('dialog', { name: 'Error' });
	await expect(details).toContainText('test failure at example.com/room');
	const report = details.getByRole('button', { name: 'Report' });
	expect((await report.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	// Report opens the in-app form as a bug, with the problem's details to send along.
	await report.tap();
	const sent = await sendReport(page);
	expect(sent.kind).toBe('bug');
	expect(sent.title).toContain('test failure');
	expect(sent.details).toContain('uncaught');
	expect(sent.build).toMatch(/^v/);
	expect(JSON.stringify(sent)).not.toContain('SECRET');
	expect(JSON.stringify(sent)).not.toContain('script=abc');

	// The log survives a reload (so a crash can be reported after reopening), until cleared.
	await page.reload();
	expect(await page.evaluate(() => localStorage.getItem('grim-games:error-log:v1'))).toContain(
		'test failure'
	);
	await expect(page.getByTestId('error-notice')).toBeHidden();
});

test('dismissing the card keeps the page as it was', async ({ page }) => {
	await page.goto('/');
	const heading = page.getByRole('heading', { level: 1 });
	const before = await heading.boundingBox();
	await page.evaluate(() => {
		void Promise.reject(new Error('rejected promise'));
	});
	const card = page.getByTestId('error-notice');
	await expect(card).toContainText('rejected promise');
	expect(await heading.boundingBox()).toEqual(before);
	await card.getByRole('button', { name: 'Dismiss' }).tap();
	await expect(card).toBeHidden();
});

test('an unknown address shows the Fool and ways out, without reporting an error', async ({
	page
}) => {
	await page.goto('/library');
	await page.goto('/no-such-page');
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	const main = page.locator('main.page');
	const notFound = page.getByTestId('not-found');
	await expect(notFound.getByRole('img', { name: 'Fool' })).toBeVisible();
	await expect(notFound).toContainText("The first time you visit this page, it doesn't exist.");
	await expect(page.getByTestId('error-notice')).toBeHidden();
	for (const name of ['Library', 'Report an issue', 'Home']) {
		const box = await main
			.getByRole(name === 'Report an issue' ? 'button' : 'link', { name })
			.boundingBox();
		expect(box!.height).toBeGreaterThanOrEqual(44);
	}
	// Compact: the Fool, the joke and the ways out fit on one screen, with no sideways scroll.
	const homeBox = await main.getByRole('link', { name: 'Home' }).boundingBox();
	expect(homeBox!.y + homeBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);

	// Report an issue opens the Report form, already titled; the address goes with it.
	await main.getByRole('button', { name: 'Report an issue' }).tap();
	const form = page.getByRole('dialog', { name: 'Report' });
	await expect(form.getByRole('textbox', { name: 'Title' })).toHaveValue('Page not found');
	await expect(form).toContainText('/no-such-page');
	await form.getByRole('button', { name: 'Cancel' }).tap();

	await main.getByRole('link', { name: 'Library' }).tap();
	await expect(page).toHaveURL(/\/library$/);
	await page.goto('/no-such-page');
	await page.getByRole('link', { name: 'Home' }).tap();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(APP_NAME);
});

test('a bad address shows Page not found once, even while a newer build waits', async ({
	page,
	context
}) => {
	// A newer build is deployed while this device still runs the one its service worker holds
	// (it changes only when the person taps Refresh). SvelteKit reloads a page that ends in an
	// error when it sees a newer version, which here loaded the held build again: endlessly.
	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
	await context.route('**/_app/version.json', (route) =>
		route.fulfill({ json: { version: 'a newer build' } })
	);
	let loads = 0;
	page.on('request', (request) => {
		if (request.resourceType() === 'document') loads++;
	});
	await page.goto('/accoun');
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	await page.waitForTimeout(3000);
	expect(loads).toBe(1);
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('if the app cannot start, a plain screen shows the error with Reload and Report', async ({
	page
}) => {
	// Simulates a broken deploy: the app's entry chunk fails to load.
	await page.route('**/_app/immutable/entry/**', (route) => route.abort());
	await page.goto('/');
	const screen = page.locator('#boot-failure');
	await expect(screen).toBeVisible({ timeout: 15_000 });
	await expect(screen.getByRole('heading')).toHaveText(`${APP_NAME} couldn't start`);
	await expect(screen).toContainText('v0.0.1 · ');
	for (const name of ['Reload', 'Load the latest version']) {
		const button = screen.getByRole('button', { name });
		expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	}
	await expect(screen.getByRole('link', { name: 'Copy and report on GitHub' })).toHaveAttribute(
		'href',
		CHOOSER
	);
});

test('a working app never shows the boot-failure screen', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(APP_NAME);
	await page.waitForTimeout(3500);
	await expect(page.locator('#boot-failure')).toHaveCount(0);
});

test('Diagnostics gathers build, device and problems on the device, without game data', async ({
	page
}) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(APP_NAME);
	await page.evaluate(() => {
		localStorage.setItem('grim-games:player-name-test', 'Sam the Storyteller');
		setTimeout(() => {
			throw new Error('diagnostics test at https://example.com/room?code=SECRET');
		});
	});
	await expect(page.getByTestId('error-notice')).toBeVisible();

	await page.goto('/diagnostics');
	const panel = page.getByTestId('diagnostics');
	// About's Advanced part, which /diagnostics opens (Trevor, 2026-10-18).
	await expect(
		page.getByRole('dialog', { name: 'Settings' }).getByRole('heading', { name: 'Advanced' })
	).toBeVisible();
	await expect(panel).toHaveAttribute('aria-busy', 'false');
	for (const name of [
		'Build',
		'Problems',
		'App updates',
		'Storage',
		'Device',
		'Settings',
		'Live room'
	]) {
		await expect(panel.getByRole('heading', { level: 2, name })).toBeVisible();
	}
	await expect(panel).toContainText('1 problem');
	// The version and commit show once, in About above; times carry the time of day.
	await expect(panel.locator('dt:text-is("Version")')).toHaveCount(0);
	await expect(panel.getByRole('link', { name: /^[0-9a-f]{7,}$/ })).toHaveCount(0);
	await expect(
		page.getByRole('dialog', { name: 'Settings' }).getByRole('link', { name: /^[0-9a-f]{7,}$/ })
	).toHaveAttribute('href', /^https:\/\/github\.com\/Phauks\/Grim-Games\/commit\//);
	await expect(panel.locator('dt:text-is("Gathered") + dd')).toHaveText(/\d{1,2}:\d{2}:\d{2}/);
	await expect(panel.getByRole('link', { name: 'Manage data' })).toHaveCount(0);

	// Copy and Download are icons beside the Advanced heading, with no Refresh (Trevor, 2026-10-19).
	const settings = page.getByRole('dialog', { name: 'Settings' });
	const heading = settings.getByRole('heading', { name: 'Advanced' });
	const h = (await heading.boundingBox())!;
	for (const name of ['Copy diagnostics', 'Download diagnostics']) {
		const icon = (await settings.getByRole('button', { name, exact: true }).boundingBox())!;
		expect(icon.height).toBeGreaterThanOrEqual(44);
		expect(Math.abs(icon.y + icon.height / 2 - (h.y + h.height / 2))).toBeLessThan(12);
	}
	await expect(settings.getByRole('button', { name: 'Refresh', exact: true })).toHaveCount(0);
	await expect(panel.getByRole('button', { name: /Copy|Download/ })).toHaveCount(0);

	// Report an issue is in About's main part, above Advanced (Trevor, 2026-10-19).
	await expect(panel.getByRole('button', { name: 'Report an issue' })).toHaveCount(0);
	const report = settings.getByRole('button', { name: 'Report an issue' });
	expect((await report.boundingBox())!.y).toBeLessThan((await heading.boundingBox())!.y);
	expect((await report.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	await report.tap();
	const sent = await sendReport(page);
	expect(sent.details).toContain('diagnostics test at example.com/room');
	expect(JSON.stringify(sent)).not.toContain('SECRET');
	expect(JSON.stringify(sent)).not.toContain('Sam the Storyteller');

	const [download] = await Promise.all([
		page.waitForEvent('download'),
		settings.getByRole('button', { name: 'Download diagnostics' }).tap()
	]);
	expect(download.suggestedFilename()).toMatch(
		/^grim-games-diagnostics-\d{4}-\d{2}-\d{2}-\d{6}\.txt$/
	);
});

test('every problem on this device is in one table, repeats counted', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(APP_NAME);
	await page.evaluate(() => {
		for (const message of ['first problem', 'second problem', 'second problem']) {
			setTimeout(() => {
				throw new Error(message);
			});
		}
	});
	await expect(page.getByTestId('error-notice')).toContainText('second problem');
	await page.getByTestId('error-notice').getByRole('button', { name: 'Details' }).tap();
	const table = page
		.getByRole('dialog', { name: 'Problems on this device' })
		.getByTestId('problems');
	const second = table.getByRole('row', { name: /second problem/ });
	await expect(table.getByRole('row', { name: /first problem/ })).toBeVisible();
	await expect(second.getByRole('cell').last()).toHaveText('2');
	// The whole row is the tap target, at least 44px tall.
	const box = (await second.boundingBox())!;
	expect(box.height).toBeGreaterThanOrEqual(44);
	await page.touchscreen.tap(box.x + box.width - 4, box.y + box.height / 2);
	await expect(page.getByRole('dialog', { name: 'Error' })).toContainText('second problem');
});

test('Clear problems is a trash can beside the X and asks first', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(APP_NAME);
	await page.evaluate(() =>
		setTimeout(() => {
			throw new Error('clear me');
		})
	);
	await page.getByTestId('error-notice').getByRole('button', { name: 'Details' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Problems on this device' });
	const clear = dialog.getByRole('button', { name: 'Clear problems' });
	const close = dialog.getByRole('button', { name: 'Close' }).first();
	const [c, x] = [(await clear.boundingBox())!, (await close.boundingBox())!];
	// Same header row, right beside the X.
	expect(Math.abs(c.y - x.y)).toBeLessThan(4);
	expect(x.x - (c.x + c.width)).toBeLessThan(c.width);
	await clear.tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).tap();
	await expect(dialog).toContainText('None');
	await expect(clear).toBeDisabled();
});

test('a missing saved game keeps the setup title, with the reason under it', async ({ page }) => {
	await page.goto('/grimoire/no-such-game/setup');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Characters');
	await expect(page.getByText('There is no saved game here on this device.')).toBeVisible();
});

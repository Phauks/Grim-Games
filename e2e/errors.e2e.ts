import { expect, test, type Page } from '@playwright/test';

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
		form.getByRole('button', { name: 'Send' }).tap()
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
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Grim-Games');
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
	const report = dialog.getByRole('button', { name: 'Report' });
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

test('an unknown address shows Page not found without reporting an error', async ({ page }) => {
	await page.goto('/no-such-page');
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	await expect(page.getByTestId('error-notice')).toBeHidden();
	await page.getByRole('link', { name: 'Home' }).tap();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Grim-Games');
});

test('if the app cannot start, a plain screen shows the error with Reload and Report', async ({
	page
}) => {
	// Simulates a broken deploy: the app's entry chunk fails to load.
	await page.route('**/_app/immutable/entry/**', (route) => route.abort());
	await page.goto('/');
	const screen = page.locator('#boot-failure');
	await expect(screen).toBeVisible({ timeout: 15_000 });
	await expect(screen.getByRole('heading')).toHaveText("Grim-Games couldn't start");
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
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Grim-Games');
	await page.waitForTimeout(3500);
	await expect(page.locator('#boot-failure')).toHaveCount(0);
});

test('Diagnostics gathers build, device and problems on the device, without game data', async ({
	page
}) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Grim-Games');
	await page.evaluate(() => {
		localStorage.setItem('grim-games:player-name-test', 'Sam the Storyteller');
		setTimeout(() => {
			throw new Error('diagnostics test at https://example.com/room?code=SECRET');
		});
	});
	await expect(page.getByTestId('error-notice')).toBeVisible();

	await page.goto('/diagnostics');
	const panel = page.getByTestId('diagnostics');
	// A Settings section, which /diagnostics opens (Trevor, 2026-10-16).
	await expect(
		page.getByRole('dialog', { name: 'Settings' }).getByRole('heading', { name: 'Diagnostics' })
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
	// Build values link to GitHub; times carry the time of day, not just the date.
	await expect(panel.getByRole('link', { name: /^[0-9a-f]{7,}$/ })).toHaveAttribute(
		'href',
		/^https:\/\/github\.com\/Phauks\/Grim-Games\/commit\//
	);
	await expect(panel.locator('dt:text-is("Gathered") + dd')).toHaveText(/\d{1,2}:\d{2}:\d{2}/);
	await expect(panel.getByRole('link', { name: 'Manage data' })).toHaveCount(0);

	// Refresh is an icon beside the section heading.
	const heading = page
		.getByRole('dialog', { name: 'Settings' })
		.getByRole('heading', { name: 'Diagnostics' });
	const refresh = page
		.getByRole('dialog', { name: 'Settings' })
		.getByRole('button', { name: 'Refresh' });
	const [h, r] = [(await heading.boundingBox())!, (await refresh.boundingBox())!];
	expect(r.height).toBeGreaterThanOrEqual(44);
	expect(Math.abs(r.y + r.height / 2 - (h.y + h.height / 2))).toBeLessThan(12);
	await refresh.tap();
	await expect(panel).toHaveAttribute('aria-busy', 'false');

	const report = panel.getByRole('button', { name: 'Report an issue' });
	expect((await report.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	await report.tap();
	const sent = await sendReport(page);
	expect(sent.details).toContain('diagnostics test at example.com/room');
	expect(JSON.stringify(sent)).not.toContain('SECRET');
	expect(JSON.stringify(sent)).not.toContain('Sam the Storyteller');

	const [download] = await Promise.all([
		page.waitForEvent('download'),
		panel.getByRole('button', { name: 'Download' }).tap()
	]);
	expect(download.suggestedFilename()).toMatch(
		/^grim-games-diagnostics-\d{4}-\d{2}-\d{2}-\d{6}\.txt$/
	);
});

test('Clear problems is a trash can beside the X and asks first', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Grim-Games');
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

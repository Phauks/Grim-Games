import { expect, test } from '@playwright/test';

test('an uncaught error shows the corner card, and Details offers a scrubbed GitHub report', async ({
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
	const report = dialog.getByRole('link', { name: 'Report' });
	expect((await report.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	const href = new URL((await report.getAttribute('href'))!);
	expect(href.searchParams.get('template')).toBe('bug_report.yml');
	expect(href.searchParams.get('error')).toContain('uncaught');
	expect(href.toString()).not.toContain('SECRET');
	expect(href.toString()).not.toContain('script%3Dabc');

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
	const href = new URL(
		(await screen.getByRole('link', { name: 'Report on GitHub' }).getAttribute('href'))!
	);
	expect(href.searchParams.get('template')).toBe('bug_report.yml');
	expect(href.searchParams.get('error')).toBeTruthy();
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

	const report = panel.getByRole('link', { name: 'Report an issue' });
	expect((await report.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	const href = (await report.getAttribute('href'))!;
	expect(href.length).toBeLessThanOrEqual(7000);
	const error = new URL(href).searchParams.get('error')!;
	expect(error).toContain('diagnostics test at example.com/room');
	expect(href).not.toContain('SECRET');
	expect(error).not.toContain('Sam the Storyteller');

	const [download] = await Promise.all([
		page.waitForEvent('download'),
		panel.getByRole('button', { name: 'Download' }).tap()
	]);
	expect(download.suggestedFilename()).toMatch(/^grim-games-diagnostics-\d{4}-\d{2}-\d{2}\.txt$/);
});

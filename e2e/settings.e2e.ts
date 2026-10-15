import { expect, test, type Page } from '@playwright/test';

/** Opens settings from the header icon and goes to a section (drill-in on phones). */
async function openSettings(page: Page, section: string) {
	await page.getByRole('banner').getByRole('button', { name: 'Settings' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await expect(dialog).toBeVisible();
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: section })
		.tap();
	await expect(dialog.getByRole('heading', { name: section, level: 2 })).toBeVisible();
	return dialog;
}

/** Taps the visible option card in a labelled radio group, as a finger would. */
const choose = (page: Page, group: string, option: string) =>
	page.getByRole('radiogroup', { name: group }).getByText(option, { exact: true }).tap();

const rootStyle = (page: Page, name: string) =>
	page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n), name);

test('the grimoire theme and the app header are on every page', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'grimoire');
	expect(await rootStyle(page, '--font-display')).toContain('Cinzel');
	const header = page.getByRole('banner');
	await expect(header.getByRole('link', { name: 'Grim-Games' })).toBeVisible();
	await expect(header.getByRole('button', { name: 'Settings' })).toBeVisible();

	await header.getByRole('button', { name: 'Account' }).tap();
	await expect(page.getByRole('dialog', { name: 'Accounts' })).toContainText('coming later');
});

test('/settings deep-links to the settings modal', async ({ page }) => {
	await page.goto('/settings');
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect(dialog).toBeHidden();
	await expect(page).toHaveURL(/\/$/);
});

test('a chosen text font is applied and survives a reload', async ({ page }) => {
	await page.goto('/');
	await openSettings(page, 'Fonts');
	await choose(page, 'Everything else', 'Lexend · Readability');
	expect(await rootStyle(page, '--font-text')).toContain('Lexend');

	await page.reload();
	await expect
		.poll(() => page.evaluate(() => getComputedStyle(document.body).fontFamily))
		.toContain('Lexend');
	// Outside Settings only the chosen fonts are fetched (on demand).
	const faces = () =>
		page.evaluate(() => [...document.fonts].map((f) => `${f.family}:${f.status}`).join());
	await expect.poll(faces).toMatch(/Lexend"?:loaded/);
	expect(await faces()).not.toContain('IM Fell');

	await openSettings(page, 'Fonts');
	await expect(
		page.getByRole('radiogroup', { name: 'Everything else' }).getByRole('radio', { name: /Lexend/ })
	).toBeChecked();
});

test('display font, text size and icon weight apply live', async ({ page }) => {
	await page.goto('/');
	const dialog = await openSettings(page, 'Fonts');
	await choose(page, 'Titles and character names', 'IM Fell English SC');
	expect(await rootStyle(page, '--font-display')).toContain('IM Fell English SC');

	// Phones drill in, so go back to the section list first; tablets show the sidebar.
	const back = dialog.getByRole('button', { name: 'All settings' });
	if (await back.isVisible()) await back.tap();
	await dialog.getByRole('button', { name: 'Appearance' }).tap();
	await choose(page, 'Text size', 'XL');
	expect(await rootStyle(page, '--text-scale')).toBe('1.25');
	expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe(
		'20px'
	);

	if (await back.isVisible()) await back.tap();
	await dialog.getByRole('button', { name: 'Icons' }).tap();
	await choose(page, 'Icon style', 'Fill');
	await page.getByRole('radiogroup', { name: 'Dead' }).getByRole('img', { name: 'cross' }).tap();
	await dialog.getByRole('button', { name: 'Close' }).tap();

	await expect(page.getByRole('img', { name: 'Dead' })).toHaveAttribute(
		'data-icon',
		'ph:cross-fill'
	);
	await expect(page.getByRole('img', { name: 'Night' })).toHaveAttribute(
		'data-icon',
		'ph:moon-stars-fill'
	);
});

test('Storyteller help is a list of switches, saved on the device', async ({ page }) => {
	await page.goto('/');
	const dialog = await openSettings(page, 'Storyteller help');
	await expect(dialog.getByRole('radiogroup')).toHaveCount(0);
	const walkthrough = dialog.getByRole('checkbox', {
		name: 'Walk me through the night',
		includeHidden: true
	});
	await expect(walkthrough).toBeChecked();
	await dialog.getByText('Walk me through the night', { exact: true }).tap();
	await expect(walkthrough).not.toBeChecked();

	await page.reload();
	const again = await openSettings(page, 'Storyteller help');
	await expect(
		again.getByRole('checkbox', { name: 'Walk me through the night', includeHidden: true })
	).not.toBeChecked();
	await expect(
		again.getByRole('checkbox', { name: 'Work out night answers', includeHidden: true })
	).toBeChecked();
});

test('text size changes text only: icons, spacing and buttons keep their size', async ({
	page
}) => {
	await page.goto('/');
	const settingsButton = page.getByRole('banner').getByRole('button', { name: 'Settings' });
	const night = page.getByRole('img', { name: 'Night' });
	const measure = async () => ({
		button: await settingsButton.boundingBox(),
		icon: await night.boundingBox(),
		gap: await page.evaluate(() =>
			getComputedStyle(document.documentElement).getPropertyValue('--space-4')
		),
		spacePx: await page.evaluate(() => {
			const probe = document.createElement('div');
			probe.style.width = 'var(--space-4)';
			document.body.append(probe);
			const width = probe.getBoundingClientRect().width;
			probe.remove();
			return width;
		}),
		text: await page.evaluate(() => getComputedStyle(document.body).fontSize)
	});
	const before = await measure();

	const dialog = await openSettings(page, 'Appearance');
	await choose(page, 'Text size', 'XXL');
	await dialog.getByRole('button', { name: 'Close' }).tap();
	const after = await measure();

	expect(after.text).not.toBe(before.text);
	expect(after.spacePx).toBe(before.spacePx);
	expect(after.icon?.width).toBe(before.icon?.width);
	expect(after.button?.width).toBe(before.button?.width);
	expect(after.button?.height).toBe(before.button?.height);
});

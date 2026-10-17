import { expect, test, type Page } from '@playwright/test';

// Settings > Tokens (Trevor, 2026-10-16): character token and reminder sizes, token colours
// with a contrast readout. Stored on the device and applied everywhere tokens show.

async function openTokens(page: Page) {
	await page.getByRole('banner').getByRole('button', { name: 'Settings' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Board and tokens' })
		.tap();
	await expect(dialog.getByRole('heading', { name: 'Board and tokens', level: 2 })).toBeVisible();
	return dialog;
}

const rootStyle = (page: Page, name: string) =>
	page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

test('token and reminder sizes apply to the tokens and stay after a reload', async ({ page }) => {
	await page.goto('/reference');
	const token = page.locator('[data-testid="reference-card"] .token').first();
	const reminder = page.getByTestId('reminder-token').first();
	await expect(token).toBeVisible();
	const before = (await token.boundingBox())!.width;
	const chipBefore = (await reminder.boundingBox())!.height;

	const dialog = await openTokens(page);
	// Sizes are percentages on a slider (50% to 200%).
	await dialog.getByRole('slider', { name: 'Character token size' }).fill('1.5');
	await dialog.getByRole('slider', { name: 'Reminder token size' }).fill('1.5');
	await expect(dialog).toContainText('150%');
	expect(await rootStyle(page, '--token-scale')).toBe('1.5');
	expect(await rootStyle(page, '--reminder-scale')).toBe('1.5');
	await dialog.getByRole('button', { name: 'Close' }).tap();

	expect((await token.boundingBox())!.width).toBeCloseTo(before * 1.5, 0);
	expect((await reminder.boundingBox())!.height).toBeGreaterThan(chipBefore * 1.3);

	await page.reload();
	await expect(token).toBeVisible();
	expect((await token.boundingBox())!.width).toBeCloseTo(before * 1.5, 0);
});

test('a token colour can be changed, warns when hard to read, and resets', async ({ page }) => {
	await page.goto('/reference');
	const dialog = await openTokens(page);
	const contrast = dialog.getByTestId('token-contrast');
	await expect(contrast).toContainText('easy to read');
	const reset = dialog.getByRole('button', { name: 'Reset Token text' });
	await expect(reset).toBeDisabled();

	// Pale text on the pale faces is flagged, in place (no layout change).
	const box = (await contrast.boundingBox())!;
	await dialog.getByLabel('Token text', { exact: true }).fill('#eeeeee');
	await expect(contrast).toContainText('hard to read');
	expect((await contrast.boundingBox())!.height).toBeCloseTo(box.height, 0);
	expect(await rootStyle(page, '--on-reminder')).toBe('#eeeeee');

	await reset.tap();
	await expect(contrast).not.toContainText('hard to read');
	expect(await rootStyle(page, '--on-reminder')).not.toBe('#eeeeee');
});

test('character names on grimoire tokens are off by default and shown when switched on', async ({
	page
}) => {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Fortune Teller', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();

	const seat = page.locator('[data-testid="seat"][aria-label^="Seat 1:"]');
	const token = seat.locator('.token');
	await expect(token).toBeVisible();
	await expect(seat.getByTestId('token-name')).toHaveCount(0);
	const size = (await token.boundingBox())!;
	/** Where the leaves and the icon are: no name setting may move or resize them. */
	const marks = () =>
		token.evaluate((el) =>
			[...el.querySelectorAll('.leaf, img')].map((m) => {
				const r = m.getBoundingClientRect();
				return [r.x, r.y, r.width, r.height].map(Math.round).join(',');
			})
		);
	const before = await marks();

	const dialog = page.getByRole('dialog', { name: 'Settings' });
	async function openTokens() {
		// Settings are in the app's menu, opened from the game toolbar.
		await page.getByRole('button', { name: /^(Open menu|Menu)$/ }).tap();
		await page
			.getByRole('dialog', { name: 'Menu' })
			.getByRole('button', { name: 'Settings' })
			.tap();
		await dialog
			.getByRole('navigation', { name: 'Settings sections' })
			.getByRole('button', { name: 'Board and tokens' })
			.tap();
	}
	await openTokens();
	const label = 'Show character names on grimoire tokens';
	const toggle = dialog.getByRole('checkbox', { name: label, includeHidden: true });
	await expect(toggle).not.toBeChecked();
	await dialog.getByText(label, { exact: true }).tap();
	await expect(toggle).toBeChecked();
	await dialog.getByRole('button', { name: 'Close' }).tap();

	// Curved along the edge, inside the token, which keeps its size; leaves and icon stay put.
	const name = seat.getByTestId('token-name');
	await expect(name).toHaveText('Fortune Teller');
	const box = (await token.boundingBox())!;
	expect(box.width).toBeCloseTo(size.width, 0);
	const text = (await name.boundingBox())!;
	expect(text.x).toBeGreaterThanOrEqual(box.x);
	expect(text.x + text.width).toBeLessThanOrEqual(box.x + box.width + 1);
	expect(text.y + text.height).toBeLessThanOrEqual(box.y + box.height + 1);
	expect(await marks()).toEqual(before);
	await page.reload();
	await expect(name).toHaveText('Fortune Teller');

	// The player name is always a badge on the token (Trevor, 2026-10-17); no setting.
	await openTokens();
	await expect(dialog.getByTestId('token-preview').getByTestId('token-player-name')).toHaveCount(1);
	await expect(dialog.getByText('Player name placement', { exact: false })).toHaveCount(0);
	await page.keyboard.press('Escape');

	// On the board, a seat with a character draws its name on the token instead of the pill
	// under it; an empty seat keeps the pill.
	await expect(seat.getByTestId('token-player-name')).toHaveText('Seat 1');
	await expect(seat.locator('.seat-disc > .name')).toHaveCount(0);
	const empty = page.locator('[data-testid="seat"][aria-label^="Seat 2:"]');
	await expect(empty.getByTestId('token-player-name')).toHaveCount(0);
	await expect(empty.locator('.seat-disc > .name')).toHaveText('Seat 2');
});

test('the token preview stays in view while the token settings scroll', async ({ page }) => {
	// Trevor (2026-10-17): previews stick to the top so changes stay in view.
	await page.goto('/');
	await page.getByRole('banner').getByRole('button', { name: 'Settings' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Board and tokens' })
		.tap();
	const preview = dialog.getByTestId('token-preview');
	await expect(preview.getByTestId('token-player-name')).toBeVisible();
	const content = dialog.locator('section.content');
	await content.evaluate((el) => el.scrollTo(0, el.scrollHeight));
	expect(await content.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
	await expect(preview).toBeInViewport();
	// Just under the section's sticky heading row (Trevor, 2026-10-17).
	const row = (await dialog
		.getByRole('heading', { name: 'Board and tokens', level: 2 })
		.locator('..')
		.boundingBox())!;
	expect(Math.abs(row.y - (await content.boundingBox())!.y)).toBeLessThan(2);
	expect(Math.abs((await preview.boundingBox())!.y - (row.y + row.height))).toBeLessThan(2);
});

test('the preview draws the reminder as the board does, at the board size', async ({ page }) => {
	// Trevor (2026-10-17): the preview showed the inline chip, not the reminder token.
	await page.goto('/');
	const dialog = await openTokens(page);
	const preview = dialog.getByTestId('token-preview');
	const reminder = preview.getByTestId('board-reminder');
	await expect(reminder).toHaveAttribute('aria-label', 'Red Herring reminder');
	await expect(preview.getByTestId('reminder-token')).toHaveCount(0);
	const before = (await reminder.boundingBox())!.width;
	await dialog.getByRole('slider', { name: 'Reminder token size' }).fill('1.5');
	await expect
		.poll(async () => (await reminder.boundingBox())!.width)
		.toBeGreaterThan(before * 1.4);
});

test('night order badges sit on the side leaves, counting this game’s characters', async ({
	page
}) => {
	// Trevor (2026-10-17): night order on the leaves, characters only (no Dusk, Dawn or info).
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	for (const [n, name] of [
		[1, 'Empath'],
		[2, 'Washerwoman'],
		[3, 'Poisoner']
	] as const) {
		await page.getByRole('button', { name: new RegExp(`^Seat ${n}:`) }).tap();
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${n}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await page.keyboard.press('Escape');
		await expect(sheet).toBeHidden();
	}
	const seat = (n: number) => page.locator(`[data-testid="seat"][aria-label^="Seat ${n}:"]`);
	await expect(seat(1).getByTestId('night-badge')).toHaveCount(0);

	await page.getByRole('button', { name: /^(Open menu|Menu)$/ }).tap();
	await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Settings' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Board and tokens' })
		.tap();
	const label = 'Show night order numbers on tokens';
	await dialog.getByText(label, { exact: true }).tap();
	await expect(dialog.getByTestId('token-preview').getByTestId('night-badge')).toHaveCount(2);
	await dialog.getByRole('button', { name: 'Close' }).tap();

	// First night: Poisoner, Washerwoman, then Empath; other nights: Poisoner, then Empath.
	const badge = (n: number, night: string) =>
		seat(n).locator(`[data-testid="night-badge"][data-night="${night}"]`);
	await expect(badge(3, 'first')).toHaveText('1');
	await expect(badge(2, 'first')).toHaveText('2');
	await expect(badge(1, 'first')).toHaveText('3');
	await expect(badge(3, 'other')).toHaveText('1');
	await expect(badge(1, 'other')).toHaveText('2');
	await expect(badge(2, 'other')).toHaveCount(0);
});

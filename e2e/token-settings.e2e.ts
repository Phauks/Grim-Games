import { expect, test, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';
import { APP_NAME } from '../src/lib/core/app-name.ts';
import { openSettingsDialog } from './shell.ts';

// Settings > Tokens (Trevor, 2026-10-16): character token and reminder sizes, token colours
// with a contrast readout. Stored on the device and applied everywhere tokens show.

async function openTokens(page: Page) {
	await openSettingsDialog(page);
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Tokens' })
		.tap();
	await expect(dialog.getByRole('heading', { name: 'Tokens', level: 2 })).toBeVisible();
	return dialog;
}

const rootStyle = (page: Page, name: string) =>
	page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

test('token sizes are for the board: tokens elsewhere keep their size, and the setting stays', async ({
	page
}) => {
	// Trevor (2026-10-19) picked "Board only": a large Character token size broke sheets and
	// dialogs, so it sizes the grimoire board's seats (tested below) and nothing else.
	await page.goto('/reference');
	const token = page.getByTestId('character-table').locator('[data-field="token"] .token').first();
	const reminder = page.getByTestId('reminder-token').first();
	await expect(token).toBeVisible();
	const before = (await token.boundingBox())!.width;
	const chipBefore = (await reminder.boundingBox())!.height;

	const dialog = await openTokens(page);
	// Sizes are percentages on a slider (50% to 200%).
	await dialog.getByRole('slider', { name: 'Character token size' }).fill('1.5');
	await dialog.getByRole('slider', { name: 'Reminder token size' }).fill('1.5');
	// Reminder chips in text have their own size (Trevor, 2026-10-18).
	await dialog.getByRole('slider', { name: 'Reminder text size' }).fill('1.5');
	await expect(dialog).toContainText('150%');
	expect(await rootStyle(page, '--token-scale')).toBe('1.5');
	expect(await rootStyle(page, '--reminder-scale')).toBe('1.5');
	expect(await rootStyle(page, '--inline-reminder-scale')).toBe('1.5');
	await dialog.getByRole('button', { name: 'Close' }).tap();

	expect((await token.boundingBox())!.width).toBeCloseTo(before, 0);
	expect((await reminder.boundingBox())!.height).toBeGreaterThan(chipBefore * 1.3);

	await page.reload();
	await expect(token).toBeVisible();
	expect(await rootStyle(page, '--token-scale')).toBe('1.5');
	expect((await token.boundingBox())!.width).toBeCloseTo(before, 0);
});

test('a token colour can be changed, warns when hard to read, and resets', async ({ page }) => {
	await page.goto('/reference');
	const dialog = await openTokens(page);
	const contrast = dialog.getByTestId('token-contrast').first();
	await expect(contrast).toContainText('easy to read');
	const reset = dialog.getByRole('button', { name: 'Reset Token text' });
	await expect(reset).toBeDisabled();

	// Pale text on the pale faces is flagged, in place (no layout change).
	const box = (await contrast.boundingBox())!;
	await dialog.getByLabel('Token text', { exact: true }).fill('#eeeeee');
	await expect(contrast).toContainText('hard to read');
	expect((await contrast.boundingBox())!.height).toBeCloseTo(box.height, 0);
	expect(await rootStyle(page, '--on-token')).toBe('#eeeeee');
	// Reminder text is its own colour (Trevor, 2026-10-18).
	expect(await rootStyle(page, '--on-reminder')).not.toBe('#eeeeee');

	await reset.tap();
	await expect(contrast).not.toContainText('hard to read');
	expect(await rootStyle(page, '--on-token')).not.toBe('#eeeeee');
});

test('border, reminder text and reminder text band are colours of their own', async ({ page }) => {
	// Trevor (2026-10-18): the border is separate from the fill, reminder text from token
	// text, and the band behind a reminder's words from its face.
	await page.goto('/');
	const dialog = await openTokens(page);
	await dialog.getByLabel('Token border', { exact: true }).fill('#224466');
	expect(await rootStyle(page, '--token-face-shade')).toBe('#224466');
	expect(await rootStyle(page, '--token-face')).not.toBe('#224466');
	await dialog.getByLabel('Reminder text', { exact: true }).fill('#663322');
	expect(await rootStyle(page, '--on-reminder')).toBe('#663322');
	expect(await rootStyle(page, '--on-token')).not.toBe('#663322');
	const label = dialog.getByTestId('reminder-preview').locator('.label').first();
	const face = await label.evaluate((el) => getComputedStyle(el).backgroundColor);
	await dialog.getByLabel('Reminder text band', { exact: true }).fill('#336622');
	await expect
		.poll(() => label.evaluate((el) => getComputedStyle(el).backgroundColor))
		.not.toBe(face);
	expect(await rootStyle(page, '--reminder-label-face')).toBe('#336622');
	expect(await rootStyle(page, '--reminder-face')).not.toBe('#336622');
});

test('reminder leaves and setup notation can be shown or hidden', async ({ page }) => {
	// Trevor (2026-10-18): "add option to show or hide Reminder Leaves and Setup Notation".
	await page.goto('/');
	const dialog = await openTokens(page);
	const preview = dialog.getByTestId('token-preview');
	const leaves = preview.locator('.leaf[data-kind="reminder"]');
	await expect.poll(() => leaves.count()).toBeGreaterThan(0);
	// Both nights' leaves too (Trevor, 2026-10-19: the sample wakes on both kinds of night).
	await expect(preview.locator('.leaf[data-kind="night"]')).toHaveCount(2);
	await dialog.getByText('Reminder leaves', { exact: true }).tap();
	await expect(leaves).toHaveCount(0);
	// The sample (Godfather) changes setup, so its flower follows the switch.
	const flower = dialog.getByRole('checkbox', {
		name: 'Setup notation',
		exact: true,
		includeHidden: true
	});
	const setupMark = preview.locator('[data-kind="setup"]');
	await expect(flower).not.toBeChecked();
	await expect(setupMark).toHaveCount(0);
	await dialog.getByText('Setup notation', { exact: true }).tap();
	await expect(flower).toBeChecked();
	await expect(setupMark).toHaveCount(1);
	const saved = await page.evaluate(
		() => JSON.parse(localStorage.getItem('grim-games:preferences:v1') ?? '{}').tokenAppearance
	);
	expect(saved).toMatchObject({ reminderLeaves: false, setupFlower: true });
});

test('the setup flower moves the name on the token only when asked', async ({ page }) => {
	// Trevor (2026-10-19): the setup badge should not offset the name, unless a setting says so.
	await page.goto('/');
	const dialog = await openTokens(page);
	const preview = dialog.getByTestId('token-preview');
	const moves = dialog.getByRole('checkbox', {
		name: 'Setup notation moves name',
		includeHidden: true
	});
	await expect(moves).toBeDisabled();
	await dialog.getByText('Show character names on tokens', { exact: true }).tap();
	// The name runs along this arc; with the flower in the way it ends sooner.
	const arc = preview.locator('svg.marks path[id^="name-"]');
	const end = () => arc.getAttribute('d');
	const full = await end();
	await dialog.getByText('Setup notation', { exact: true }).tap();
	await expect(preview.locator('[data-kind="setup"]')).toHaveCount(1);
	expect(await end()).toBe(full);
	await expect(moves).toBeEnabled();
	await dialog.getByText('Setup notation moves name', { exact: true }).tap();
	await expect.poll(end).not.toBe(full);
});

test('names and reminders in text each have their own text, icon and badge sizes', async ({
	page
}) => {
	// Trevor (2026-10-18): "they are all different to me, and different from each other".
	await page.goto('/');
	const dialog = await openTokens(page);
	const preview = dialog.getByTestId('in-text-preview');
	const name = preview.locator('.line .badge');
	const nameIcon = name.locator('.icon');
	const chip = preview.getByTestId('reminder-token');
	const owner = chip.locator('img.owner');
	const size = async (l: typeof name) => (await l.boundingBox())!;
	const [n0, i0, c0, o0] = [
		await size(name),
		await size(nameIcon),
		await size(chip),
		await size(owner)
	];
	// The badge alone grows round the same name and icon.
	await dialog.getByRole('slider', { name: 'Name badge size' }).fill('2');
	await expect.poll(async () => (await size(name)).height).toBeGreaterThan(n0.height * 1.7);
	expect((await size(nameIcon)).height).toBeCloseTo(i0.height, 0);
	await dialog.getByRole('slider', { name: 'Name icon size' }).fill('2');
	await expect.poll(async () => (await size(nameIcon)).height).toBeGreaterThan(i0.height * 1.8);
	expect((await size(owner)).height).toBeCloseTo(o0.height, 0);
	const fontSize = () =>
		name.locator('.name').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
	const f0 = await fontSize();
	await dialog.getByRole('slider', { name: 'Name text size' }).fill('1.5');
	await expect.poll(fontSize).toBeCloseTo(f0 * 1.5, 0);
	await dialog.getByRole('slider', { name: 'Reminder icon size' }).fill('0.5');
	await expect.poll(async () => (await size(owner)).height).toBeLessThan(o0.height * 0.6);
	await dialog.getByRole('slider', { name: 'Reminder badge size' }).fill('2');
	await expect.poll(async () => (await size(chip)).height).toBeGreaterThan(c0.height * 1.3);
	expect(await rootStyle(page, '--inline-name-text')).toBe('1.5');
	expect(await rootStyle(page, '--inline-reminder-badge')).toBe('2');
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
	await toBoard(page);
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
			.getByRole('dialog', { name: APP_NAME })
			.getByRole('button', { name: 'Settings' })
			.tap();
		await dialog
			.getByRole('navigation', { name: 'Settings sections' })
			.getByRole('button', { name: 'Tokens' })
			.tap();
	}
	await openTokens();
	const label = 'Show character names on tokens';
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

	// Every token follows the setting (Trevor, 2026-10-18): the seat sheet's and Show to
	// player's too.
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	await expect(sheet.getByTestId('token-name').first()).toHaveText('Fortune Teller');
	await sheet.getByRole('button', { name: 'Show to player' }).tap();
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown.getByTestId('token-name')).toHaveText('Fortune Teller');
	await page.keyboard.press('Escape');
	await expect(shown).toBeHidden();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();

	// The player name is always a badge on the token (Trevor, 2026-10-17); no setting.
	await openTokens();
	await expect(dialog.getByTestId('token-preview').getByTestId('token-player-name')).toHaveCount(1);
	await expect(dialog.getByText('Player name placement', { exact: false })).toHaveCount(0);
	await page.keyboard.press('Escape');

	// On the board, every seat, with a character or empty, draws its name in the same badge
	// on the token (Trevor, 2026-10-19).
	await expect(seat.getByTestId('token-player-name')).toHaveText('Seat 1');
	await expect(seat.locator('.seat-disc > .name')).toHaveCount(0);
	const empty = page.locator('[data-testid="seat"][aria-label^="Seat 2:"]');
	await expect(empty.getByTestId('token-player-name')).toHaveText('Seat 2');
	await expect(empty.locator('.seat-disc > .name')).toHaveCount(0);
});

test('each preview box stays in view only while its own settings scroll', async ({ page }) => {
	// Trevor (2026-10-18): one box per kind of token, pinned only while its settings show.
	await page.goto('/');
	const dialog = await openTokens(page);
	const content = dialog.locator('section.content');
	const character = dialog.getByTestId('token-preview');
	const reminder = dialog.getByTestId('reminder-preview');
	await expect(character.getByTestId('token-player-name')).toBeVisible();
	// Just under the section's sticky heading row.
	const row = (await dialog
		.getByRole('heading', { name: 'Tokens', level: 2 })
		.locator('..')
		.boundingBox())!;
	const pinned = async (box: typeof character) =>
		Math.abs((await box.boundingBox())!.y - (row.y + row.height));
	await content.evaluate((el) => el.scrollTo(0, 120));
	await expect.poll(() => pinned(character)).toBeLessThan(2);
	// Down in the reminder settings, the reminder box is pinned and the character box has gone.
	await reminder.evaluate((el) => el.closest('section.setting-group')!.scrollIntoView());
	await content.evaluate((el) => el.scrollBy(0, 60));
	await expect.poll(() => pinned(reminder)).toBeLessThan(2);
	const [c, r] = [(await character.boundingBox())!, (await reminder.boundingBox())!];
	expect(c.y + c.height).toBeLessThanOrEqual(r.y + 1);
});

test("reminders in text have their own size and always show the owner's icon", async ({ page }) => {
	// Trevor (2026-10-18): "add the settings for in-line reminder tokens".
	await page.goto('/');
	const dialog = await openTokens(page);
	const chip = dialog.getByTestId('in-text-preview').getByTestId('reminder-token');
	const owner = chip.locator('img.owner');
	await expect(owner).toBeVisible();
	const before = (await chip.boundingBox())!.height;
	await dialog.getByRole('slider', { name: 'Reminder text size' }).fill('1.5');
	await expect.poll(async () => (await chip.boundingBox())!.height).toBeGreaterThan(before * 1.3);
	// The board's Reminder token size leaves it as it is.
	const after = (await chip.boundingBox())!.height;
	await dialog.getByRole('slider', { name: 'Reminder token size' }).fill('2');
	expect((await chip.boundingBox())!.height).toBeCloseTo(after, 0);
	// Always the owner's icon, never a dot (Trevor, 2026-10-18).
	await expect(owner).toBeVisible();
});

test('the preview draws the reminder as the board does, at the board size', async ({ page }) => {
	// Trevor (2026-10-17): the preview showed the inline chip, not the reminder token.
	await page.goto('/');
	const dialog = await openTokens(page);
	const preview = dialog.getByTestId('reminder-preview');
	const reminder = preview.getByTestId('board-reminder').first();
	await expect(reminder).toHaveAttribute('aria-label', 'Survives Execution reminder');
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
	await toBoard(page);
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
	await page
		.getByRole('dialog', { name: APP_NAME })
		.getByRole('button', { name: 'Settings' })
		.tap();
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Tokens' })
		.tap();
	// Night leaves, with their night order numbers (Trevor, 2026-10-22: one setting).
	await dialog.getByRole('combobox', { name: 'Night leaves', exact: true }).tap();
	await page.getByRole('option', { name: 'Leaves and numbers', exact: true }).tap();
	// The preview's one character is 1 on each night (Trevor, 2026-10-17: not absolute).
	const previewBadges = dialog.getByTestId('token-preview').getByTestId('night-badge');
	await expect(previewBadges).toHaveText(['1', '1']);
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

	// A dead player's character drops out and the rest renumber (Trevor, 2026-10-17).
	await page.getByRole('button', { name: /^Seat 2:/ }).tap();
	await sheet.getByRole('button', { name: 'Status: Alive' }).tap();
	await page
		.getByRole('dialog', { name: 'Status of Seat 2' })
		.getByRole('button', { name: 'Executed' })
		.tap();
	await expect(sheet.getByRole('button', { name: 'Status: Dead: Executed' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await expect(badge(2, 'first')).toHaveCount(0);
	await expect(badge(3, 'first')).toHaveText('1');
	await expect(badge(1, 'first')).toHaveText('2');
});

test('the token preview draws at the size the board gives its tokens', async ({ page }) => {
	// Trevor (2026-10-17): the preview size didn't match the size in play.
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose' }).tap();
	await page
		.getByRole('dialog', { name: 'Character for Seat 1' })
		.getByRole('button', { name: 'Fortune Teller', exact: true })
		.tap();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	const onBoard = page.locator('[data-testid="seat"][aria-label^="Seat 1:"] .token');
	const width = async (token: typeof onBoard) => Math.round((await token.boundingBox())!.width);

	await page.getByRole('button', { name: /^(Open menu|Menu)$/ }).tap();
	await page
		.getByRole('dialog', { name: APP_NAME })
		.getByRole('button', { name: 'Settings' })
		.tap();
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Tokens' })
		.tap();
	const preview = dialog.getByTestId('token-preview').locator('.token');
	await expect.poll(() => width(preview)).toBe(await width(onBoard));

	await dialog.getByRole('slider', { name: 'Character token size' }).fill('1.25');
	const previewed = await width(preview);
	await dialog.getByRole('button', { name: 'Close' }).tap();
	await expect.poll(() => width(onBoard)).toBe(previewed);
});

test('reminder words can run wider or wrap instead of ending in "…"', async ({ page }) => {
	// Trevor (2026-10-17): "red he..." on the Red Herring reminder; the sample is now the
	// Devil's Advocate's Survives Execution, long enough to need the room.
	await page.goto('/');
	const dialog = await openTokens(page);
	const label = dialog
		.getByTestId('reminder-preview')
		.getByTestId('board-reminder')
		.first()
		.locator('.label');
	await expect(label).toHaveText('Survives Execution');
	const cut = () => label.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
	const lines = () =>
		label.evaluate((el) =>
			Math.round(el.clientHeight / parseFloat(getComputedStyle(el).lineHeight))
		);
	// At the narrowest width the words don't fit on one line, at any board size.
	const width = dialog.getByRole('slider', { name: 'Reminder words width' });
	await width.fill('1');
	await expect.poll(cut).toBe(true);
	expect(await lines()).toBe(1);
	const top = async () => (await label.boundingBox())!.y;
	const firstLine = await top();

	// Wrapped lines go below the token, never over its icon (Trevor, 2026-10-17): the first
	// line stays put.
	await dialog.getByText('Wrap long reminder words', { exact: true }).tap();
	await expect.poll(lines).toBe(2);
	expect(await cut()).toBe(false);
	expect(Math.abs((await top()) - firstLine)).toBeLessThan(1);
	await dialog.getByText('Wrap long reminder words', { exact: true }).tap();
	await expect.poll(lines).toBe(1);

	await width.fill('3');
	await expect.poll(cut).toBe(false);
	expect(await lines()).toBe(1);
});

test('the player name badge is set beside the character token preview', async ({ page }) => {
	// Trevor (2026-10-20): "player name badges should have settings in tokens under character
	// tokens. This should include the font, size, how far from the token".
	await page.goto('/');
	const dialog = await openTokens(page);
	const name = dialog.getByTestId('token-preview').getByTestId('token-player-name');
	const box = async () => (await name.boundingBox())!;
	const before = await box();
	await dialog.getByRole('slider', { name: 'Player name size' }).fill('1.5');
	await expect.poll(async () => (await box()).width).toBeGreaterThan(before.width * 1.3);
	const sized = await box();
	await dialog.getByRole('slider', { name: 'Player name distance' }).fill('0.2');
	await expect.poll(async () => (await box()).y).toBeGreaterThan(sized.y);
	await expect(dialog.getByTestId('player-font')).toBeVisible();
	const saved = await page.evaluate(() =>
		JSON.parse(localStorage.getItem('grim.boardLooks') ?? 'null')
	);
	expect(saved).toMatchObject({ nameSize: 1.5, nameOffset: 0.2 });
});

test('the character name and reminder fonts are set beside their token previews', async ({
	page
}) => {
	// Trevor (2026-10-18): the token and in-text fonts always match, so they live in Tokens.
	await page.goto('/');
	const dialog = await openTokens(page);
	await expect(
		dialog.getByTestId('character-font').getByRole('combobox', { name: 'Character names' })
	).toBeVisible();
	await expect(
		dialog.getByTestId('reminder-font').getByRole('combobox', { name: 'Reminder tokens' })
	).toBeVisible();
	// The board reminder's words use the Reminder tokens font, as the chips in text do.
	const label = dialog
		.getByTestId('reminder-preview')
		.getByTestId('board-reminder')
		.first()
		.locator('.label');
	const chip = dialog.getByTestId('in-text-preview').getByTestId('reminder-token');
	const family = (el: typeof label) => el.evaluate((e) => getComputedStyle(e).fontFamily);
	expect(await family(label)).toBe(await family(chip));

	const back = dialog.getByRole('button', { name: 'All settings' });
	if (await back.isVisible()) await back.tap();
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Text', exact: true })
		.tap();
	await expect(dialog.getByRole('combobox', { name: 'Headings' })).toBeVisible();
	await expect(dialog.getByRole('combobox', { name: 'Character names' })).toHaveCount(0);
	await expect(dialog.getByRole('combobox', { name: 'Reminder tokens' })).toHaveCount(0);
});

test('reminder highlight can be switched and restyled, and the owner icon recoloured', async ({
	page
}) => {
	// Trevor (2026-10-20): settings for reminder glow effects (on/off and how they look) and
	// for the reminder's source mark (the owning character's icon): on/off and colour.
	await page.goto('/');
	const dialog = await openTokens(page);
	const lit = dialog.getByTestId('lit-reminder-sample').locator('.reminder');
	const style = (prop: 'outlineStyle' | 'filter') =>
		lit.evaluate((el, p) => getComputedStyle(el)[p], prop);
	await expect.poll(() => style('outlineStyle')).toBe('solid');
	expect(await style('filter')).toBe('none');
	await dialog.getByRole('combobox', { name: 'Highlight look', exact: true }).tap();
	await page.getByRole('option', { name: 'Glow', exact: true }).tap();
	await expect.poll(() => style('outlineStyle')).toBe('none');
	expect(await style('filter')).toContain('drop-shadow');
	await dialog.getByText('Highlight reminders', { exact: true }).tap();
	await expect.poll(() => style('filter')).toBe('none');
	await expect(
		dialog.getByRole('combobox', { name: 'Highlight look', exact: true })
	).toBeDisabled();

	const icon = lit.locator('img');
	await expect(icon).toBeVisible();
	// The owner's icon is always shown, in its owner's alignment (Trevor, 2026-10-23): no
	// switch to hide it and no colour to pick.
	await expect(dialog.getByText("Owner's icon on reminders", { exact: true })).toHaveCount(0);
	await expect(dialog.getByText("Owner's icon colour", { exact: true })).toHaveCount(0);
	const saved = await page.evaluate(
		() => JSON.parse(localStorage.getItem('grim-games:preferences:v1') ?? '{}').tokenAppearance
	);
	expect(saved).toMatchObject({
		reminderHighlight: false,
		reminderHighlightLook: 'glow'
	});
});

test('character icon size is set for character tokens and reminder tokens apart', async ({
	page
}) => {
	// Trevor (2026-10-23): "character icon size should be a setting on character tokens and
	// reminder tokens". Each preview shows its own.
	await page.goto('/');
	const dialog = await openTokens(page);
	const tokenIcon = dialog.getByTestId('token-preview').locator('img').first();
	const reminderIcon = dialog.getByTestId('reminder-preview').locator('img').first();
	const width = async (icon: typeof tokenIcon) => (await icon.boundingBox())!.width;
	const tokenBefore = await width(tokenIcon);
	const reminderBefore = await width(reminderIcon);
	const sliders = dialog.getByRole('slider', { name: 'Character icon size' });
	await expect(sliders).toHaveCount(2);
	await sliders.first().fill('0.5');
	await expect.poll(() => width(tokenIcon)).toBeCloseTo(tokenBefore / 2, 0);
	expect(await width(reminderIcon)).toBeCloseTo(reminderBefore, 0);
	await sliders.last().fill('1.25');
	await expect.poll(() => width(reminderIcon)).toBeCloseTo(reminderBefore * 1.25, 0);
	const saved = await page.evaluate(
		() => JSON.parse(localStorage.getItem('grim-games:preferences:v1') ?? '{}').tokenAppearance
	);
	expect(saved).toMatchObject({ tokenIconScale: 0.5, reminderIconScale: 1.25 });
	// The fill of ∞ symbols is each token's own now, not a setting here.
	await expect(dialog.getByText('Filled ∞ token symbols', { exact: true })).toHaveCount(0);
});

test('night leaves can be switched off, or carry night order numbers', async ({ page }) => {
	// Trevor (2026-10-22): "add setting for night leaves. should be combined with the night
	// order number section".
	await page.goto('/');
	const dialog = await openTokens(page);
	const preview = dialog.getByTestId('token-preview');
	const leaves = preview.locator('.leaf[data-kind="night"]');
	const badgeSize = dialog.getByRole('slider', { name: 'Night order badge size' });
	const nightLeaves = dialog.getByRole('combobox', { name: 'Night leaves', exact: true });
	const choose = async (option: string) => {
		await nightLeaves.tap();
		await page.getByRole('option', { name: option, exact: true }).tap();
	};
	// Leaves by default, with no numbers.
	await expect(nightLeaves).toContainText('Leaves');
	await expect(leaves).toHaveCount(2);
	await expect(preview.getByTestId('night-badge')).toHaveCount(0);
	await expect(badgeSize).toBeDisabled();
	await choose('Leaves and numbers');
	await expect(preview.getByTestId('night-badge')).toHaveText(['1', '1']);
	await expect(badgeSize).toBeEnabled();
	await choose('Off');
	await expect(leaves).toHaveCount(0);
	await expect(preview.getByTestId('night-badge')).toHaveCount(0);
	await expect(badgeSize).toBeDisabled();
});

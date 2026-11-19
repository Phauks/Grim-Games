import { expect, test, type Locator, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';
import { closePane } from './players.ts';
import { openBand, openBoardTheme, openTheme } from './theme.ts';

// Token settings (Trevor, 2026-10-16): character token and reminder sizes, token colours with a
// contrast readout. Stored on the device and applied everywhere tokens show. They are bands of
// the game's Theme, beside the real board, with no previews (Trevor, 2026-11-18).

const rootStyle = (page: Page, name: string) =>
	page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

/** A Trouble Brewing game with these characters in seats 1, 2 and on. */
async function boardWith(page: Page, characters: string[]) {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	for (const [i, name] of characters.entries()) {
		const n = i + 1;
		await page.getByRole('button', { name: new RegExp(`^Seat ${n}:`) }).tap();
		await sheet.getByRole('button', { name: 'Choose' }).first().tap();
		await page
			.getByRole('dialog', { name: `Character for Seat ${n}` })
			.getByRole('button', { name, exact: true })
			.tap();
		await page.keyboard.press('Escape');
		await expect(sheet).toBeHidden();
	}
}

/**
 * Changes Theme settings beside the board, then closes the pane: on a phone it is a sheet
 * over the board and its reminder bank.
 */
async function inTheme(page: Page, band: string, change: (theme: Locator) => Promise<void>) {
	await change(await openBoardTheme(page, band));
	await closePane(page);
}

const seat = (page: Page, n: number) =>
	page.locator(`[data-testid="seat"][aria-label^="Seat ${n}:"]`);
// A new game, characters chosen, then the Theme: longer than a test's usual 30 seconds.
test.describe.configure({ timeout: 90_000 });

const bankReminder = (page: Page, name: string) =>
	page.getByRole('list', { name: 'Reminder bank' }).getByRole('button', { name, exact: true });

test('token sizes are for the board: tokens elsewhere keep their size, and the setting stays', async ({
	page
}) => {
	// Trevor (2026-10-19) picked "Board only": a large Character token size broke sheets and
	// dialogs, so it sizes the grimoire board's seats (tested below) and nothing else.
	await page.goto('/character-analyzer#poisoner');
	const token = page.getByTestId('character-table').locator('[data-field="token"] .token').first();
	const reminder = page.getByTestId('reminder-token').first();
	await expect(token).toBeVisible();
	const before = (await token.boundingBox())!.width;
	const chipBefore = (await reminder.boundingBox())!.height;

	const theme = await openTheme(page, 'Character tokens');
	// Sizes are percentages on a slider (50% to 200%).
	await theme.getByRole('slider', { name: 'Character token size' }).fill('1.5');
	await expect(theme).toContainText('150%');
	await openBand(theme, 'Reminder tokens');
	await theme.getByRole('slider', { name: 'Reminder token size' }).fill('1.5');
	// Reminder chips in text have their own size (Trevor, 2026-10-18).
	await openBand(theme, 'Names in text');
	await theme.getByRole('slider', { name: 'Reminder text size' }).fill('1.5');
	// Each size applies on the next animation frame.
	await expect.poll(() => rootStyle(page, '--token-scale')).toBe('1.5');
	await expect.poll(() => rootStyle(page, '--reminder-scale')).toBe('1.5');
	await expect.poll(() => rootStyle(page, '--inline-reminder-scale')).toBe('1.5');

	await page.goto('/character-analyzer#poisoner');
	await expect(token).toBeVisible();
	expect(await rootStyle(page, '--token-scale')).toBe('1.5');
	expect((await token.boundingBox())!.width).toBeCloseTo(before, 0);
	expect((await reminder.boundingBox())!.height).toBeGreaterThan(chipBefore * 1.3);
});

test('the board grows its tokens and reminders as their sizes change', async ({ page }) => {
	// Trevor (2026-10-17): the preview size didn't match the size in play; the board itself
	// shows the change now (Trevor, 2026-11-18).
	await boardWith(page, ['Fortune Teller']);
	const onBoard = seat(page, 1).locator('.token');
	const reminder = bankReminder(page, 'Red Herring reminder');
	const width = async (l: Locator) => (await l.boundingBox())!.width;
	const [token0, reminder0] = [await width(onBoard), await width(reminder)];
	await inTheme(page, 'Character tokens', async (theme) => {
		await theme.getByRole('slider', { name: 'Character token size' }).fill('1.25');
		await openBand(theme, 'Reminder tokens');
		await theme.getByRole('slider', { name: 'Reminder token size' }).fill('1.5');
	});
	await expect.poll(() => width(onBoard)).toBeGreaterThan(token0 * 1.15);
	await expect.poll(() => width(reminder)).toBeGreaterThan(reminder0 * 1.4);
});

test('a token colour can be changed, warns when hard to read, and resets', async ({ page }) => {
	const theme = await openTheme(page, 'Character tokens');
	const contrast = theme.getByTestId('token-contrast').first();
	await expect(contrast).toContainText('easy to read');
	// The reset icon beside the name, as on every setting (described by the name).
	const name = await theme
		.getByText('Token text', { exact: true })
		.and(theme.locator('[id]'))
		.getAttribute('id');
	const reset = theme
		.getByRole('button', { name: 'Reset to default' })
		.and(theme.locator(`[aria-describedby="${name}"]`));
	await expect(reset).toBeDisabled();

	// Pale text on the pale faces is flagged, in place (no layout change).
	const box = (await contrast.boundingBox())!;
	await theme.getByLabel('Token text', { exact: true }).fill('#eeeeee');
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
	// The Poisoner's reminder moves, so its band is the band colour, not its team's.
	await boardWith(page, ['Poisoner']);
	const label = bankReminder(page, 'Poisoned reminder').locator('.label');
	const face = await label.evaluate((el) => getComputedStyle(el).backgroundColor);
	await inTheme(page, 'Character tokens', async (theme) => {
		await theme.getByLabel('Token border', { exact: true }).fill('#224466');
		expect(await rootStyle(page, '--token-face-shade')).toBe('#224466');
		expect(await rootStyle(page, '--token-face')).not.toBe('#224466');
		await openBand(theme, 'Reminder tokens');
		await theme.getByLabel('Reminder text', { exact: true }).fill('#663322');
		expect(await rootStyle(page, '--on-reminder')).toBe('#663322');
		expect(await rootStyle(page, '--on-token')).not.toBe('#663322');
		await theme.getByLabel('Reminder text band', { exact: true }).fill('#336622');
	});
	await expect
		.poll(() => label.evaluate((el) => getComputedStyle(el).backgroundColor))
		.not.toBe(face);
	expect(await rootStyle(page, '--reminder-label-face')).toBe('#336622');
	expect(await rootStyle(page, '--reminder-face')).not.toBe('#336622');
});

test('reminder leaves and setup notation can be shown or hidden', async ({ page }) => {
	// Trevor (2026-10-18): "add option to show or hide Reminder Leaves and Setup Notation".
	await boardWith(page, ['Poisoner', 'Baron']);
	const theme = await openBoardTheme(page, 'Character tokens');
	const leaves = seat(page, 1).locator('.leaf[data-kind="reminder"]');
	await expect.poll(() => leaves.count()).toBeGreaterThan(0);
	// Both nights' leaves too: the Poisoner wakes on both kinds of night.
	await expect(seat(page, 1).locator('.leaf[data-kind="night"]')).toHaveCount(2);
	await theme.getByText('Reminder leaves', { exact: true }).tap();
	await expect(leaves).toHaveCount(0);
	// The Baron changes setup, so its flower follows the switch.
	const flower = theme.getByRole('checkbox', {
		name: 'Setup notation',
		exact: true,
		includeHidden: true
	});
	const setupMark = seat(page, 2).locator('[data-kind="setup"]');
	await expect(flower).not.toBeChecked();
	await expect(setupMark).toHaveCount(0);
	await theme.getByText('Setup notation', { exact: true }).tap();
	await expect(flower).toBeChecked();
	await expect(setupMark).toHaveCount(1);
	const saved = await page.evaluate(
		() => JSON.parse(localStorage.getItem('grim-games:preferences:v1') ?? '{}').tokenAppearance
	);
	expect(saved).toMatchObject({ reminderLeaves: false, setupFlower: true });
});

test('the setup flower moves the name on the token only when asked', async ({ page }) => {
	// Trevor (2026-10-19): the setup badge should not offset the name, unless a setting says so.
	await boardWith(page, ['Baron']);
	const theme = await openBoardTheme(page, 'Character tokens');
	const moves = theme.getByRole('checkbox', {
		name: 'Setup notation moves name',
		includeHidden: true
	});
	await expect(moves).toBeDisabled();
	await theme.getByText('Show character names on tokens', { exact: true }).tap();
	// The name runs along this arc; with the flower in the way it ends sooner.
	const arc = seat(page, 1).locator('svg.marks path[id^="name-"]');
	const end = () => arc.getAttribute('d');
	const full = await end();
	await theme.getByText('Setup notation', { exact: true }).tap();
	await expect(seat(page, 1).locator('[data-kind="setup"]')).toHaveCount(1);
	expect(await end()).toBe(full);
	await expect(moves).toBeEnabled();
	await theme.getByText('Setup notation moves name', { exact: true }).tap();
	await expect.poll(end).not.toBe(full);
});

test('names and reminders in text each have their own text, icon and badge sizes', async ({
	page
}) => {
	// Trevor (2026-10-18): "they are all different to me, and different from each other".
	const theme = await openTheme(page, 'Names in text');
	const sizes = [
		['Name badge size', '2'],
		['Name icon size', '2'],
		['Name text size', '1.5'],
		['Reminder icon size', '0.5'],
		['Reminder badge size', '2']
	] as const;
	for (const [label, value] of sizes)
		await theme.getByRole('slider', { name: label, exact: true }).fill(value);
	await expect.poll(() => rootStyle(page, '--inline-name-text')).toBe('1.5');
	await expect.poll(() => rootStyle(page, '--inline-reminder-badge')).toBe('2');
	const saved = await page.evaluate(
		() => JSON.parse(localStorage.getItem('grim-games:preferences:v1') ?? '{}').tokenAppearance
	);
	expect(saved).toMatchObject({
		inlineNameBadgeScale: 2,
		inlineNameIconScale: 2,
		inlineNameTextScale: 1.5,
		inlineReminderIconScale: 0.5,
		inlineReminderBadgeScale: 2
	});
});

test('character names on grimoire tokens are off by default and shown when switched on', async ({
	page
}) => {
	await boardWith(page, ['Fortune Teller']);
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	const token = seat(page, 1).locator('.token');
	await expect(token).toBeVisible();
	await expect(seat(page, 1).getByTestId('token-name')).toHaveCount(0);
	const size = (await token.boundingBox())!;
	/** Where the leaves and the icon are: no name setting may move or resize them. */
	const marks = () =>
		token.evaluate((el) => {
			const t = el.getBoundingClientRect();
			return [...el.querySelectorAll('.leaf, img')].map((m) => {
				const r = m.getBoundingClientRect();
				return [r.x - t.x, r.y - t.y, r.width, r.height].map(Math.round).join(',');
			});
		});
	const before = await marks();

	await inTheme(page, 'Character tokens', async (theme) => {
		const label = 'Show character names on tokens';
		const toggle = theme.getByRole('checkbox', { name: label, includeHidden: true });
		await expect(toggle).not.toBeChecked();
		await theme.getByText(label, { exact: true }).tap();
		await expect(toggle).toBeChecked();
		// The player name is always a badge on the token (Trevor, 2026-10-17); no setting.
		await expect(theme.getByText('Player name placement', { exact: false })).toHaveCount(0);
	});

	// Curved along the edge, inside the token, which keeps its size; leaves and icon stay put.
	const name = seat(page, 1).getByTestId('token-name');
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

	// Every token follows the setting (Trevor, 2026-10-18): Show to player's too. The seat
	// sheet draws no token now, only the standard character row (Trevor, 2026-10-31).
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	await expect(sheet.getByTestId('token-name')).toHaveCount(0);
	await sheet.getByRole('button', { name: 'Show to player' }).tap();
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown.getByTestId('token-name')).toHaveText('Fortune Teller');
	await page.keyboard.press('Escape');
	await expect(shown).toBeHidden();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();

	// On the board, every seat, with a character or empty, draws its name in the same badge
	// on the token (Trevor, 2026-10-19).
	await expect(seat(page, 1).getByTestId('token-player-name')).toHaveText('Seat 1');
	await expect(seat(page, 1).locator('.seat-disc > .name')).toHaveCount(0);
	await expect(seat(page, 2).getByTestId('token-player-name')).toHaveText('Seat 2');
	await expect(seat(page, 2).locator('.seat-disc > .name')).toHaveCount(0);
});

test("reminders in text have their own size and always show the owner's icon", async ({ page }) => {
	// Trevor (2026-10-18): "add the settings for in-line reminder tokens".
	await page.goto('/character-analyzer#poisoner');
	const chip = page.getByTestId('reminder-token').first();
	const owner = chip.locator('img.owner');
	await expect(owner).toBeVisible();
	const before = (await chip.boundingBox())!.height;
	const theme = await openTheme(page, 'Names in text');
	await theme.getByRole('slider', { name: 'Reminder text size' }).fill('1.5');
	// The board's Reminder token size leaves it as it is.
	await openBand(theme, 'Reminder tokens');
	await theme.getByRole('slider', { name: 'Reminder token size' }).fill('2');
	await page.goto('/character-analyzer#poisoner');
	await expect(owner).toBeVisible();
	expect((await chip.boundingBox())!.height).toBeGreaterThan(before * 1.3);
	expect((await chip.boundingBox())!.height).toBeLessThan(before * 1.7);
});

test('night order badges sit on the side leaves, counting this game’s characters', async ({
	page
}) => {
	// Trevor (2026-10-17): night order on the leaves, characters only (no Dusk, Dawn or info).
	await boardWith(page, ['Empath', 'Washerwoman', 'Poisoner']);
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await expect(seat(page, 1).getByTestId('night-badge')).toHaveCount(0);

	// Night leaves, with their night order numbers (Trevor, 2026-10-22: one setting).
	const theme = await openBoardTheme(page, 'Character tokens');
	await theme.getByRole('combobox', { name: 'Night leaves', exact: true }).tap();
	await page.getByRole('option', { name: 'Leaves and numbers', exact: true }).tap();

	// First night: Poisoner, Washerwoman, then Empath; other nights: Poisoner, then Empath.
	const badge = (n: number, night: string) =>
		seat(page, n).locator(`[data-testid="night-badge"][data-night="${night}"]`);
	await expect(badge(3, 'first')).toHaveText('1');
	await expect(badge(2, 'first')).toHaveText('2');
	await expect(badge(1, 'first')).toHaveText('3');
	await expect(badge(3, 'other')).toHaveText('1');
	await expect(badge(1, 'other')).toHaveText('2');
	await expect(badge(2, 'other')).toHaveCount(0);

	// A dead player's character drops out and the rest renumber (Trevor, 2026-10-17).
	await closePane(page);
	await page.getByRole('button', { name: /^Seat 2:/ }).tap();
	await sheet.getByRole('combobox', { name: 'Status: Alive' }).tap();
	await page.getByRole('listbox').getByRole('option', { name: 'Executed' }).tap();
	await expect(sheet.getByRole('combobox', { name: 'Status: Dead: Executed' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await expect(badge(2, 'first')).toHaveCount(0);
	await expect(badge(3, 'first')).toHaveText('1');
	await expect(badge(1, 'first')).toHaveText('2');
});

test('reminder words can run wider or wrap instead of ending in "…"', async ({ page }) => {
	// Trevor (2026-10-17): "red he..." on the Red Herring reminder.
	await boardWith(page, ['Fortune Teller']);
	const reminder = bankReminder(page, 'Red Herring reminder');
	const label = reminder.locator('.label');
	await expect(label).toHaveText(/Red Herring/i);
	const cut = () => label.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
	const lines = () =>
		label.evaluate((el) =>
			Math.round(el.clientHeight / parseFloat(getComputedStyle(el).lineHeight))
		);
	const width = (theme: Locator) => theme.getByRole('slider', { name: 'Reminder words width' });
	const wrap = (theme: Locator) =>
		theme.getByText('Wrap long reminder words', { exact: true }).tap();
	// At the narrowest width the words don't fit on one line.
	await inTheme(page, 'Reminder tokens', (theme) => width(theme).fill('1'));
	await expect.poll(cut).toBe(true);
	expect(await lines()).toBe(1);
	/** The words' top, from the token's: the bank may scroll. */
	const top = async () => (await label.boundingBox())!.y - (await reminder.boundingBox())!.y;
	const firstLine = await top();

	// Wrapped lines go below the token, never over its icon (Trevor, 2026-10-17): the first
	// line stays put.
	await inTheme(page, 'Reminder tokens', wrap);
	await expect.poll(lines).toBe(2);
	expect(await cut()).toBe(false);
	expect(Math.abs((await top()) - firstLine)).toBeLessThan(1);
	await inTheme(page, 'Reminder tokens', async (theme) => {
		await wrap(theme);
		await width(theme).fill('3');
	});
	await expect.poll(lines).toBe(1);
	await expect.poll(cut).toBe(false);
});

test('the player name badge is set with the character tokens', async ({ page }) => {
	// Trevor (2026-10-20): "player name badges should have settings in tokens under character
	// tokens. This should include the font, size, how far from the token".
	await boardWith(page, ['Fortune Teller']);
	const name = seat(page, 1).getByTestId('token-player-name');
	const box = async () => (await name.boundingBox())!;
	const before = await box();
	const theme = await openBoardTheme(page, 'Character tokens');
	await theme.getByRole('slider', { name: 'Player name size' }).fill('1.5');
	await expect.poll(async () => (await box()).width).toBeGreaterThan(before.width * 1.3);
	const sized = await box();
	await theme.getByRole('slider', { name: 'Player name distance' }).fill('0.2');
	await expect.poll(async () => (await box()).y).toBeGreaterThan(sized.y);
	await expect(theme.getByTestId('player-font')).toBeVisible();
	const saved = await page.evaluate(() =>
		JSON.parse(localStorage.getItem('grim.boardLooks') ?? 'null')
	);
	expect(saved).toMatchObject({ nameSize: 1.5, nameOffset: 0.2 });
});

test('the character name and reminder fonts are set with their tokens, not in Text', async ({
	page
}) => {
	// Trevor (2026-10-18): the token and in-text fonts always match, so they live with tokens.
	const theme = await openTheme(page, 'Reminder tokens');
	await expect(
		theme.getByTestId('reminder-font').getByRole('combobox', { name: 'Reminder tokens' })
	).toBeVisible();
	await openBand(theme, 'Names in text');
	await expect(
		theme.getByTestId('character-font').getByRole('combobox', { name: 'Character names' })
	).toBeVisible();

	await theme.getByTestId('theme-sheet-settings').tap();
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Text', exact: true })
		.tap();
	await expect(dialog.getByRole('combobox', { name: 'Headings' })).toBeVisible();
	await expect(dialog.getByRole('combobox', { name: 'Character names' })).toHaveCount(0);
	await expect(dialog.getByRole('combobox', { name: 'Reminder tokens' })).toHaveCount(0);
});

test('reminder highlight can be switched and restyled', async ({ page }) => {
	// Trevor (2026-10-20): settings for reminder glow effects (on/off and how they look).
	const theme = await openTheme(page, 'Reminder tokens');
	const look = theme.getByRole('combobox', { name: 'Highlight look', exact: true });
	await look.tap();
	await page.getByRole('option', { name: 'Glow', exact: true }).tap();
	await theme.getByText('Highlight reminders', { exact: true }).tap();
	await expect(look).toBeDisabled();
	// The owner's icon is always shown, in its owner's alignment (Trevor, 2026-10-23): no
	// switch to hide it and no colour to pick.
	await expect(theme.getByText("Owner's icon on reminders", { exact: true })).toHaveCount(0);
	await expect(theme.getByText("Owner's icon colour", { exact: true })).toHaveCount(0);
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
	// reminder tokens".
	await boardWith(page, ['Fortune Teller']);
	const tokenIcon = seat(page, 1).locator('.token img').first();
	const reminderIcon = bankReminder(page, 'Red Herring reminder').locator('img').first();
	const width = async (icon: Locator) => (await icon.boundingBox())!.width;
	const tokenBefore = await width(tokenIcon);
	const reminderBefore = await width(reminderIcon);
	await inTheme(page, 'Character tokens', (theme) =>
		theme.getByRole('slider', { name: 'Character icon size' }).fill('0.5')
	);
	await expect.poll(() => width(tokenIcon)).toBeCloseTo(tokenBefore / 2, 0);
	expect(await width(reminderIcon)).toBeCloseTo(reminderBefore, 0);
	const theme = await openBoardTheme(page, 'Reminder tokens');
	await theme.getByRole('slider', { name: 'Character icon size' }).fill('1.25');
	// The fill of ∞ symbols is each token's own now, not a setting here.
	await expect(theme.getByText('Filled ∞ token symbols', { exact: true })).toHaveCount(0);
	await closePane(page);
	await expect.poll(() => width(reminderIcon)).toBeCloseTo(reminderBefore * 1.25, 0);
	const saved = await page.evaluate(
		() => JSON.parse(localStorage.getItem('grim-games:preferences:v1') ?? '{}').tokenAppearance
	);
	expect(saved).toMatchObject({ tokenIconScale: 0.5, reminderIconScale: 1.25 });
});

test('night leaves can be switched off, or carry night order numbers', async ({ page }) => {
	// Trevor (2026-10-22): "add setting for night leaves. should be combined with the night
	// order number section".
	await boardWith(page, ['Poisoner']);
	const leaves = seat(page, 1).locator('.leaf[data-kind="night"]');
	const badges = seat(page, 1).getByTestId('night-badge');
	const theme = await openBoardTheme(page, 'Character tokens');
	const badgeSize = theme.getByRole('slider', { name: 'Night order badge size' });
	const nightLeaves = theme.getByRole('combobox', { name: 'Night leaves', exact: true });
	const choose = async (option: string) => {
		await nightLeaves.tap();
		await page.getByRole('option', { name: option, exact: true }).tap();
	};
	// Leaves by default, with no numbers.
	await expect(nightLeaves).toContainText('Leaves');
	await expect(leaves).toHaveCount(2);
	await expect(badges).toHaveCount(0);
	await expect(badgeSize).toBeDisabled();
	await choose('Leaves and numbers');
	await expect(badges).toHaveText(['1', '1']);
	await expect(badgeSize).toBeEnabled();
	await choose('Off');
	await expect(leaves).toHaveCount(0);
	await expect(badges).toHaveCount(0);
	await expect(badgeSize).toBeDisabled();
});

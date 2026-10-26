import { expect, test } from '@playwright/test';
import { openSettingsDialog } from './shell.ts';
import { toBoard } from './new-game.ts';

test('an info token is shown full screen and only the close button hides it', async ({ page }) => {
	await page.goto('/info-tokens');
	await page.getByRole('button', { name: 'Did you vote today?', exact: true }).tap();

	const shown = page.getByTestId('show-to-player');
	await expect(shown).toBeVisible();
	await expect(shown.getByRole('heading')).toHaveText('Did you vote today?');
	// Opaque: it covers the whole viewport.
	const box = await shown.boundingBox();
	const viewport = page.viewportSize();
	expect(box?.width).toBe(viewport?.width);
	expect(box?.height).toBe(viewport?.height);

	// A tap on the background does nothing (Pocket Grimoire #28).
	await page.touchscreen.tap(20, (viewport?.height ?? 600) - 20);
	await expect(shown).toBeVisible();

	await shown.getByRole('button', { name: 'Close' }).tap();
	await expect(shown).toBeHidden();
});

test('"You are" asks for a character, then shows its token and ability', async ({ page }) => {
	await page.goto('/info-tokens');
	await page.getByRole('button', { name: 'You are', exact: true }).tap();
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Empath');
	await page.getByRole('button', { name: 'Empath', exact: true }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();

	const shown = page.getByTestId('show-to-player');
	await expect(shown.getByRole('heading')).toHaveText('You are');
	await expect(shown.getByRole('img', { name: /Empath token/ })).toBeVisible();
	await expect(shown).toContainText('Each night, you learn how many of your 2 alive neighbors');
});

test('a shown token fits the screen at any token size', async ({ page }) => {
	// Trevor (2026-10-19): at 150% the Sweetheart ran off the phone. Token size is for the board
	// only now, so the player's view fits the token to the screen at the largest size too.
	await page.goto('/info-tokens');
	await openSettingsDialog(page);
	const settings = page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Tokens' })
		.tap();
	await settings.getByRole('slider', { name: 'Character token size' }).fill('2');
	await settings.getByRole('slider', { name: 'Reminder token size' }).fill('2');
	await settings.getByRole('button', { name: 'Close' }).tap();

	await page.getByRole('button', { name: 'You are', exact: true }).tap();
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Sweetheart');
	await page.getByRole('button', { name: 'Sweetheart', exact: true }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();

	const shown = page.getByTestId('show-to-player');
	const token = shown.getByTestId('shown-character').locator('.token').first();
	await expect(token).toBeVisible();
	const viewport = page.viewportSize()!;
	const box = (await token.boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.y).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
	expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
	// At most three quarters of the width, as at 100% (ShownCard).
	expect(box.width).toBeLessThanOrEqual(viewport.width * 0.75 + 1);
	// Nothing in the player's view runs past the edge either.
	expect(await shown.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('a custom info token keeps its bold words and survives a reload', async ({ page }) => {
	await page.goto('/info-tokens');
	await page.getByRole('button', { name: 'New info token' }).tap();
	await page.getByRole('textbox', { name: 'Text' }).fill('You are **mad** about something');
	await page.getByRole('button', { name: 'Confirm' }).tap();

	await page.reload();
	const card = page.getByRole('button', { name: 'You are mad about something', exact: true });
	await expect(card.locator('strong')).toHaveText('mad');
	await card.tap();
	await expect(page.getByTestId('show-to-player').locator('strong')).toHaveText('mad');
	await page.getByTestId('show-to-player').getByRole('button', { name: 'Close' }).tap();

	// Delete confirms in its own dialog; Cancel keeps the card.
	await page.getByRole('button', { name: 'Delete You are mad about something' }).tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).tap();
	await expect(card).toBeVisible();
	await page.getByRole('button', { name: 'Delete You are mad about something' }).tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).tap();
	await page.reload();
	await expect(card).toHaveCount(0);
});

test('the Standard and Custom sections collapse and stay that way', async ({ page }) => {
	await page.goto('/info-tokens');
	const toggle = page.getByRole('button', { name: 'Standard' });
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await toggle.tap();
	await expect(page.getByRole('button', { name: 'You are', exact: true })).toBeHidden();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Standard' })).toHaveAttribute(
		'aria-expanded',
		'false'
	);
	await page.getByRole('button', { name: 'Standard' }).tap();
	await expect(page.getByRole('button', { name: 'You are', exact: true })).toBeVisible();
});

test('"This player is" shows several characters, e.g. for the Dreamer', async ({ page }) => {
	await page.goto('/info-tokens');
	await page.getByRole('button', { name: 'This player is', exact: true }).tap();
	const search = page.getByRole('searchbox', { name: 'Search characters' });
	await search.fill('Empath');
	await page.getByRole('button', { name: 'Empath', exact: true }).tap();
	await search.fill('Imp');
	await page.getByRole('button', { name: 'Imp', exact: true }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	const shown = page.getByTestId('show-to-player');
	await expect(shown).toContainText('Empath');
	await expect(shown).toContainText('Imp');
});

const choice = (page: import('@playwright/test').Page, name: string) =>
	page.getByRole('group', { name: 'Bluff characters' }).getByRole('button', {
		name: new RegExp(`^${name}(, .*)?$`)
	});

test('the Storyteller sets the 3 Demon bluffs at once and shows them as a list', async ({
	page
}) => {
	await page.goto('/spikes/bluffs');
	await page.getByRole('button', { name: 'Demon bluffs', exact: true }).tap();
	// One set only, without a Lunatic.
	await expect(page.getByTestId('bluff-set')).toHaveCount(1);
	await page.getByRole('button', { name: 'Choose' }).tap();

	// Each choice shows its ability text, and the list can be searched.
	await expect(choice(page, 'Monk')).toContainText('Each night*, choose a player');
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('inv');
	await choice(page, 'Investigator').tap();
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('');
	await choice(page, 'Monk').tap();
	await choice(page, 'Saint').tap();
	await expect(choice(page, 'Librarian')).toBeDisabled();
	await page.getByRole('button', { name: 'Confirm' }).tap();

	const set = page.getByTestId('bluff-set');
	await expect(set).toContainText('Investigator');
	// The set's pencil, eye and delete share its name's line (Trevor, 2026-10-19).
	const name = (await set.getByText('Demon', { exact: true }).boundingBox())!;
	for (const label of [
		'Choose the Demon bluffs',
		'Show the Demon bluffs',
		'Clear the Demon bluffs'
	]) {
		const box = (await set.getByRole('button', { name: label }).boundingBox())!;
		expect(box.y).toBeLessThan(name.y + name.height);
		expect(box.y + box.height).toBeGreaterThan(name.y);
	}
	await set.getByRole('button', { name: 'Show the Demon bluffs' }).tap();
	// The open one: the Lunatic sample on the same page has its own (closed) player view.
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown.getByRole('heading')).toHaveText('These characters are not in play');
	// A list with abilities, not tokens.
	await expect(shown.getByRole('listitem')).toHaveCount(3);
	await expect(shown).toContainText('Each night*, choose a player');
	await shown.getByRole('button', { name: 'Close' }).tap();
	await expect(page.getByRole('dialog', { name: 'Demon bluffs' })).toBeVisible();
});

test('the bluff picker puts the chosen places beside the list when there is room', async ({
	page
}) => {
	// Trevor, 2026-10-22: two columns on tablets and wider, chosen on the left; phones keep one.
	await page.goto('/spikes/bluffs');
	await page.getByRole('button', { name: 'Demon bluffs', exact: true }).tap();
	await page.getByRole('button', { name: 'Choose' }).tap();
	await expect(choice(page, 'Monk')).toBeVisible();
	// Measured before anything scrolls: the chosen places stay pinned over a scrolled list.
	const chosen = (await page.getByRole('list', { name: 'Chosen' }).boundingBox())!;
	const list = (await page.getByRole('group', { name: 'Bluff characters' }).boundingBox())!;
	// Two columns once the sheet is 36rem wide (576 CSS pixels at the default text size).
	if (list.x + list.width - chosen.x >= 576) {
		expect(chosen.x + chosen.width).toBeLessThanOrEqual(list.x);
		expect(chosen.y).toBeLessThan(list.y + list.height);
	} else {
		expect(chosen.y + chosen.height).toBeLessThanOrEqual(list.y);
	}
	expect(page.viewportSize()!.width >= 600).toBe(chosen.x + chosen.width <= list.x);
	await choice(page, 'Monk').tap();
	// Choosing still never pushes anything.
	const before = (await page.getByRole('list', { name: 'Chosen' }).boundingBox())!.height;
	await choice(page, 'Saint').tap();
	expect((await page.getByRole('list', { name: 'Chosen' }).boundingBox())!.height).toBeCloseTo(
		before,
		0
	);
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
		)
	).toBe(true);
});

test("characters in play are marked for the Demon's bluffs, but the Drunk's Townsfolk is not", async ({
	page
}) => {
	await page.goto('/spikes/bluffs');
	await page.getByRole('button', { name: 'Demon bluffs', exact: true }).tap();
	await page.getByRole('button', { name: 'Choose' }).tap();
	// Hidden at first (Trevor, 2026-10-20), then shown with the toggle.
	await expect(choice(page, 'Empath')).toHaveCount(0);
	await page.getByText('Not in play only', { exact: true }).tap();
	// Marked, never locked: the Storyteller can override anything (Trevor).
	await expect(choice(page, 'Empath')).toBeEnabled();
	await expect(choice(page, 'Empath')).toContainText('In play');
	// The Chef's seat is the Drunk (wiki: Drunk), so the Chef is not in play.
	await expect(choice(page, 'Chef')).not.toContainText('In play');
	await choice(page, 'Chef').tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('bluff-set')).toContainText('Chef');
});

test("in a Lunatic game the second set is the Lunatic's and may include characters in play", async ({
	page
}) => {
	await page.goto('/spikes/bluffs');
	await page.getByRole('button', { name: 'Demon bluffs (Lunatic game)' }).tap();
	await expect(page.getByTestId('bluff-set')).toHaveCount(1);
	await page.getByRole('button', { name: 'Add a set' }).tap();
	// The Lunatic's set lists characters in play from the start.
	await expect(page.getByRole('checkbox', { name: 'Not in play only' })).not.toBeChecked();
	await expect(choice(page, 'Sailor')).toBeEnabled();
	await expect(choice(page, 'Sailor')).toContainText('In play');
	await choice(page, 'Sailor').tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	const lunatic = page.locator('[data-testid="bluff-set"][data-set="Lunatic"]');
	await expect(lunatic).toContainText('Sailor');
	await expect(lunatic).not.toContainText('In play: replace');
});

test('the Storyteller adds more bluff sets and deletes one after confirming', async ({ page }) => {
	await page.goto('/spikes/bluffs');
	await page.getByRole('button', { name: 'Demon bluffs', exact: true }).tap();
	for (const name of ['Monk', 'Mayor']) {
		await page.getByRole('button', { name: 'Add a set' }).tap();
		await choice(page, name).tap();
		await page.getByRole('button', { name: 'Confirm' }).tap();
	}
	await expect(page.getByTestId('bluff-set')).toHaveCount(3);
	const second = page.locator('[data-testid="bluff-set"][data-set="Set 2"]');
	await expect(second).toContainText('Monk');
	await second.getByRole('button', { name: 'Delete the Set 2 bluffs' }).tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('bluff-set')).toHaveCount(2);
	await expect(page.locator('[data-testid="bluff-set"][data-set="Set 2"]')).toContainText('Mayor');
});

test("a character's own card is filled in and shown, e.g. the Mezepheles's secret word", async ({
	page
}) => {
	await page.goto('/info-tokens');
	// The section says, in a popover, that these cards are only used while the character is in play.
	await page.getByRole('button', { name: 'About Character-Specific cards' }).tap();
	await expect(page.getByRole('dialog', { name: 'Character-Specific' })).toContainText(
		'Only used while the character is in play.'
	);
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Your Secret Word is (Mezepheles)', exact: true }).tap();
	// The card's words as the title, its character below, no brackets (Trevor, 2026-10-18).
	const dialog = page.getByRole('dialog', { name: /Mezepheles\s*Your Secret Word is$/ });
	await expect(dialog).toContainText('Mezepheles');
	await dialog.getByRole('textbox', { name: 'Word' }).fill('lantern');
	await dialog.getByRole('textbox', { name: 'Word' }).press('Enter');
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown.getByRole('heading')).toHaveText('Your Secret Word is');
	await expect(shown).toContainText('lantern');
	await shown.getByRole('button', { name: 'Close' }).tap();
	// The word is kept for the next time.
	await page.getByRole('button', { name: 'Your Secret Word is (Mezepheles)', exact: true }).tap();
	await expect(dialog.getByRole('textbox', { name: 'Word' })).toHaveValue('lantern');
});

test('custom cards: bold and italic buttons, alphabetical order, and the New tile last', async ({
	page
}) => {
	await page.goto('/info-tokens');
	for (const text of ['Zebra card', 'apple card']) {
		await page.getByRole('button', { name: 'New info token' }).tap();
		await page.getByRole('textbox', { name: 'Text' }).fill(text);
		await page.getByRole('button', { name: 'Confirm' }).tap();
	}
	await page.getByRole('button', { name: 'New info token' }).tap();
	const field = page.getByRole('textbox', { name: 'Text' });
	await field.fill('You are cursed');
	// Select "cursed", then make it bold with the button, no markers typed.
	await field.evaluate((el) => {
		const text = el.firstChild!;
		const range = document.createRange();
		range.setStart(text, 8);
		range.setEnd(text, 14);
		const selection = document.getSelection()!;
		selection.removeAllRanges();
		selection.addRange(range);
	});
	await page.getByRole('button', { name: 'Bold' }).tap();
	await expect(page.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('button', { name: 'Confirm' }).tap();

	await expect(
		page.getByRole('button', { name: 'You are cursed', exact: true }).locator('strong')
	).toHaveText('cursed');
	// Alphabetical, whatever the case; the New tile stays last.
	const names = await page
		.getByRole('button', { name: /^(apple card|Zebra card|You are cursed|New info token)$/ })
		.allTextContents();
	expect(names.map((n) => n.trim())).toEqual(['apple card', 'You are cursed', 'Zebra card', 'New']);
});

test("Share blurs what is behind it, on setup's Characters screen as on the board", async ({
	page
}) => {
	// Trevor, 2026-10-26 (playtest): players look at the join code, so nothing behind it may be
	// read. The player view itself is already opaque.
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	const blurred = () =>
		page
			.locator("[data-scope='dialog'][data-part='backdrop']")
			.last()
			.evaluate((el) => getComputedStyle(el).backdropFilter);
	await page.getByRole('button', { name: 'Share', exact: true }).tap();
	await expect(page.getByRole('dialog', { name: 'Share' })).toBeVisible();
	expect(await blurred()).toContain('blur');
	await page.keyboard.press('Escape');
	await page.goto(`${new URL(page.url()).pathname}/setup`);
	await page.getByRole('button', { name: 'Share' }).tap();
	await expect(page.getByRole('dialog', { name: 'Share' })).toBeVisible();
	expect(await blurred()).toContain('blur');
});

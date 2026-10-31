import { expect, test, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';

// The info-token sheet the grimoire board opens from its header (Trevor, 2026-10-16).

async function openSheet(page: Page, name = 'Info tokens') {
	await page.goto('/spikes/info-tokens');
	await page.getByRole('button', { name, exact: true }).tap();
	await expect(page.getByRole('button', { name: 'This is the Demon', exact: true })).toBeVisible();
}

const shown = (page: Page) => page.locator('[data-testid="show-to-player"][open]');

test('"This is the Demon" is shown at once, for the Storyteller to point', async ({ page }) => {
	await openSheet(page);
	// No search box: too few cards for it to help (Trevor, 2026-10-16).
	await expect(page.getByRole('searchbox', { name: 'Search info tokens' })).toHaveCount(0);
	await page.getByRole('button', { name: 'This is the Demon', exact: true }).tap();
	await expect(shown(page).getByRole('heading')).toHaveText('This is the Demon');
	await shown(page).getByRole('button', { name: 'Close' }).tap();
	// The sheet comes back, at the list, for the next card.
	await expect(page.getByRole('button', { name: 'This is the Demon', exact: true })).toBeVisible();
});

test('"not in play" with no bluffs yet opens the bluff picker', async ({ page }) => {
	await openSheet(page);
	await page.getByRole('button', { name: 'These characters are not in play', exact: true }).tap();
	await expect(page.getByTestId('bluff-picker')).toHaveText('Bluff picker opened');
});

test('"not in play" asks which bluff set when there are several', async ({ page }) => {
	await openSheet(page, 'Info tokens (two bluff sets)');
	await page.getByRole('button', { name: 'These characters are not in play', exact: true }).tap();
	await page.getByRole('list', { name: 'Bluff sets' }).getByRole('button', { name: /Set 2/ }).tap();
	await expect(shown(page)).toContainText('Empath');
	await expect(shown(page)).toContainText('Slayer');
	await expect(shown(page)).not.toContainText('Chef');
});

test('the sheet shows a character card and edits and deletes a custom card', async ({ page }) => {
	await openSheet(page);
	await page.getByRole('button', { name: 'You are', exact: true }).tap();
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Empath');
	await page.getByRole('button', { name: 'Empath', exact: true }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(shown(page).getByRole('img', { name: /Empath token/ })).toBeVisible();
	await shown(page).getByRole('button', { name: 'Close' }).tap();

	await page.getByRole('button', { name: 'New info token' }).tap();
	await page.getByRole('textbox', { name: 'Text' }).fill('You are **cursed**');
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await page.getByRole('button', { name: 'Edit You are cursed' }).tap();
	await page.getByRole('textbox', { name: 'Text' }).fill('You are **hexed**');
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await page.getByRole('button', { name: 'You are hexed', exact: true }).tap();
	await expect(shown(page).locator('strong')).toHaveText('hexed');
	await shown(page).getByRole('button', { name: 'Close' }).tap();

	await page.getByRole('button', { name: 'Delete You are hexed' }).tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByRole('button', { name: 'You are hexed', exact: true })).toHaveCount(0);
	// No Undo on the info screens (Trevor, 2026-10-16): the confirm is the safeguard.
	await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
});

test("each card's + adds it to cards shown together, which can be reordered", async ({ page }) => {
	await openSheet(page);
	// A madness card of the Storyteller's own that asks for a character.
	await page.getByRole('button', { name: 'New info token' }).tap();
	await page.getByRole('textbox', { name: 'Text' }).fill('You are **mad** that you are');
	await page.getByRole('combobox', { name: 'Characters to show' }).tap();
	await page.getByRole('option', { name: 'Exactly', exact: true }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();

	// No mode switch: a tap shows a card, its + adds it (Trevor, 2026-10-16).
	await expect(page.getByRole('radiogroup', { name: 'How cards are shown' })).toHaveCount(0);
	await page
		.getByRole('button', { name: 'Add You are mad that you are to the cards to show' })
		.tap();
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Empath');
	await page.getByRole('button', { name: 'Empath', exact: true }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await page
		.getByRole('button', { name: 'Add This character selected you to the cards to show' })
		.tap();
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Chef');
	await page.getByRole('button', { name: 'Chef', exact: true }).tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();

	// Added in the wrong order, then moved up.
	const list = page.getByTestId('chain-list');
	await expect(list.getByRole('listitem').first()).toContainText('1. You are mad that you are');
	await expect(
		list.getByRole('button', { name: /^Move You are mad that you are .* up$/ })
	).toBeDisabled();
	await list.getByRole('button', { name: /^Move This character selected you .* up$/ }).tap();
	await expect(list.getByRole('listitem').first()).toContainText('1. This character selected you');
	// The chosen character as a badge under the card's words.
	await expect(list.getByRole('listitem').first().getByText('Chef', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Show 2 cards' }).tap();

	// Two cards: both on screen at once, no swiping.
	const view = shown(page);
	await expect(view.getByRole('region', { name: 'Card 1 of 2' })).toContainText(
		'This character selected you'
	);
	await expect(view.getByRole('region', { name: 'Card 1 of 2' })).toBeInViewport();
	await expect(view.getByRole('region', { name: 'Card 2 of 2' })).toBeInViewport();
	await expect(view.getByRole('region', { name: 'Card 2 of 2' }).locator('strong')).toHaveText(
		'mad'
	);
	await expect(view.getByRole('button', { name: 'Next card' })).toHaveCount(0);
	await view.getByRole('button', { name: 'Close' }).tap();

	// More than three cards are swiped through.
	await page.getByRole('button', { name: 'Add This is the Demon to the cards to show' }).tap();
	await page.getByRole('button', { name: 'Add These are your Minions to the cards to show' }).tap();
	await page.getByRole('button', { name: 'Show 4 cards' }).tap();
	await expect(view.getByRole('region', { name: 'Card 1 of 4' })).toBeInViewport();
	await view.getByRole('button', { name: 'Next card' }).tap();
	await expect(view.getByRole('region', { name: 'Card 2 of 4' })).toBeInViewport();
	await view.getByRole('button', { name: 'Close' }).tap();

	// The red bin clears them.
	await page.getByRole('button', { name: 'Clear the cards to show' }).tap();
	await expect(page.getByTestId('chain-list')).toHaveCount(0);
});

test('character cards load only for characters on the script', async ({ page }) => {
	// Trouble Brewing has no Mezepheles, so there is no secret word card.
	await openSheet(page);
	await expect(
		page
			.getByRole('dialog', { name: 'Info tokens' })
			.getByRole('button', { name: 'Character-Specific', exact: true })
	).toBeVisible();
	await expect(page.getByRole('button', { name: /^Your Secret Word/ })).toHaveCount(0);
});

test('a card to show with long character names keeps the sheet its width', async ({ page }) => {
	// A game's Demon bluffs with long names, then "not in play" added to the cards to show.
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await expect(page.getByTestId('seat')).toHaveCount(8);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Demon bluffs' })
		.tap();
	await page.getByRole('button', { name: 'Choose' }).first().tap();
	const names = ['Fortune Teller', 'Washerwoman', 'Investigator'];
	for (const name of names)
		await page
			.getByRole('group', { name: 'Bluff characters' })
			.getByRole('button', { name: new RegExp(`^${name}`) })
			.tap();
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Info tokens' }).tap();
	await page
		.getByRole('button', { name: 'Add These characters are not in play to the cards to show' })
		.tap();

	// The characters wrap as badges under the card; nothing goes off the side.
	const chain = page.getByTestId('chain-list');
	for (const name of names) await expect(chain.getByText(name, { exact: true })).toBeVisible();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	const overflow = await sheet.evaluate((el) =>
		[el, ...el.querySelectorAll('*')].some(
			(e) =>
				e.scrollWidth > e.clientWidth + 1 &&
				getComputedStyle(e).overflowX !== 'visible' &&
				!e.classList.contains('chain-text')
		)
	);
	expect(overflow).toBe(false);
	const box = await sheet.boundingBox();
	const show = await page.getByRole('button', { name: /^Show 1/ }).boundingBox();
	expect(show!.x + show!.width).toBeLessThanOrEqual(box!.x + box!.width + 1);
});

test('"not in play" on the info tokens page uses the bluff picker, with its toggle and Random', async ({
	page
}) => {
	// Trevor, 2026-10-18: the same picker as the Demon bluffs, Random included. Good
	// characters only, with no filter to change it (Trevor, 2026-10-19).
	await page.goto('/info-tokens');
	await page.getByRole('button', { name: 'These characters are not in play', exact: true }).tap();
	await expect(page.getByRole('combobox', { name: 'Characters' })).toHaveCount(0);
	// On from the start (Trevor, 2026-10-20).
	await expect(page.getByRole('checkbox', { name: 'Not in play only' })).toBeChecked();
	// Good characters only: no evil type is listed.
	await expect(page.getByRole('heading', { name: 'Minions' })).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Demons' })).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Townsfolk' })).toBeVisible();
	await page.getByRole('button', { name: 'Random', exact: true }).tap();
	const chosen = page.getByRole('list', { name: 'Chosen' });
	await expect(chosen.locator('[data-character-id]')).toHaveCount(3);
});

test("the board sheet's quick card opens from its header, beside the X", async ({ page }) => {
	await openSheet(page);
	// Not in the list (Trevor, 2026-10-18).
	await expect(page.getByRole('heading', { name: 'Quick card' })).toHaveCount(0);
	const quick = page.getByRole('button', { name: 'Quick card', exact: true });
	// Edged like the other buttons, so it reads as one to tap (Trevor, 2026-10-20).
	expect(await quick.evaluate((el) => getComputedStyle(el).boxShadow)).toContain('inset');
	await quick.tap();
	await page.getByRole('textbox', { name: 'Text' }).fill('You may not speak');
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(shown(page).getByRole('heading')).toHaveText('You may not speak');
});

test("the quick card's preview shows the whole card", async ({ page }) => {
	// Trevor (2026-10-30): the preview had lost its box and showed a clipped sliver.
	await openSheet(page);
	await page.getByRole('button', { name: 'Quick card', exact: true }).tap();
	await page.getByRole('textbox', { name: 'Text' }).fill('You may not speak');
	const preview = page.getByRole('figure', { name: 'Preview' });
	const heading = preview.getByRole('heading', { name: 'You may not speak' });
	await expect(heading).toBeVisible();
	const box = (await preview.boundingBox())!;
	const text = (await heading.boundingBox())!;
	expect(text.y).toBeGreaterThanOrEqual(box.y);
	expect(text.y + text.height).toBeLessThanOrEqual(box.y + box.height);
	expect(box.height).toBeGreaterThan(2 * text.height);
});

test("a long quick card's preview fits every word", async ({ page }) => {
	// Trevor (2026-10-31): after a long enough message the preview cut it off.
	await openSheet(page);
	await page.getByRole('button', { name: 'Quick card', exact: true }).tap();
	const words =
		'Tonight you learn that one of your neighbours is lying to you, and that the Demon sat ' +
		'beside them on the first night; tell nobody, or something bad will happen to you.';
	await page.getByRole('textbox', { name: 'Text' }).fill(words);
	const preview = page.getByRole('figure', { name: 'Preview' });
	const heading = preview.getByRole('heading');
	await expect(heading).toHaveText(words);
	const box = (await preview.boundingBox())!;
	const text = (await heading.boundingBox())!;
	expect(text.y).toBeGreaterThanOrEqual(box.y);
	expect(text.y + text.height).toBeLessThanOrEqual(box.y + box.height + 1);
	// Its fields stay on screen below (or beside) it.
	await expect(page.getByRole('textbox', { name: 'Text' })).toBeInViewport();
});

test('closing a shown quick card goes back to it, its words kept', async ({ page }) => {
	// Trevor (2026-10-31): a mistake shouldn't mean typing the whole card again.
	await openSheet(page);
	await page.getByRole('button', { name: 'Quick card', exact: true }).tap();
	await page.getByRole('textbox', { name: 'Text' }).fill('You may not spaek');
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await shown(page).getByRole('button', { name: 'Close' }).tap();
	const text = page.getByRole('textbox', { name: 'Text' });
	await expect(text).toHaveText('You may not spaek');
	await text.fill('You may not speak');
	await page.getByRole('button', { name: 'Confirm' }).tap();
	await expect(shown(page).getByRole('heading')).toHaveText('You may not speak');
	await shown(page).getByRole('button', { name: 'Close' }).tap();
	// Cancel leaves it, back to the list; the next quick card starts empty.
	await page.getByRole('button', { name: 'Cancel' }).tap();
	await expect(page.getByRole('button', { name: 'This is the Demon', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Quick card', exact: true }).tap();
	await expect(page.getByRole('textbox', { name: 'Text' })).toHaveText('');
});

test('a quick card can be added to the cards to show with others', async ({ page }) => {
	// Trevor (2026-10-25): a quick card goes in with other cards, like each tile's +.
	await openSheet(page);
	await page.getByRole('button', { name: 'Add This is the Demon to the cards to show' }).tap();
	await page.getByRole('button', { name: 'Quick card', exact: true }).tap();
	const add = page.getByRole('button', { name: 'Add to cards' });
	// Held in place, usable once there are words.
	await expect(add).toBeDisabled();
	await page.getByRole('textbox', { name: 'Text' }).fill('You may not speak');
	await add.tap();
	const chain = page.getByTestId('chain-list');
	await expect(chain.getByRole('listitem').first()).toContainText('1. This is the Demon');
	await expect(chain.getByRole('listitem').nth(1)).toContainText('2. You may not speak');
	await page.getByRole('button', { name: 'Show 2 cards' }).tap();
	await expect(shown(page).getByRole('heading')).toHaveText([
		'This is the Demon',
		'You may not speak'
	]);
});

test('opening a card that asks for characters leaves the keyboard closed', async ({ page }) => {
	// Sheets never focus a field when they open (Trevor, 2026-10-19).
	await openSheet(page);
	await page.getByRole('button', { name: 'You are', exact: true }).tap();
	const search = page.getByRole('searchbox', { name: 'Search characters' });
	await expect(search).toBeVisible();
	await expect(search).not.toBeFocused();

	// The same on the Info tokens page.
	await page.goto('/info-tokens');
	await page.getByRole('button', { name: 'You are', exact: true }).tap();
	await expect(search).toBeVisible();
	await expect(search).not.toBeFocused();
});

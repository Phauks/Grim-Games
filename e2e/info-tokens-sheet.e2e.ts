import { expect, test, type Page } from '@playwright/test';

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
	await page.getByRole('button', { name: 'More characters' }).tap();
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
			.getByRole('button', { name: 'Character Specific', exact: true })
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
	await page.getByRole('button', { name: 'Start game' }).tap();
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

test('"not in play" on the info tokens page uses the bluff picker, with its filter and Random', async ({
	page
}) => {
	// Trevor, 2026-10-18: the same picker as the Demon bluffs, Random included.
	await page.goto('/info-tokens');
	await page.getByRole('button', { name: 'These characters are not in play', exact: true }).tap();
	const filter = page.getByRole('combobox', { name: 'Characters' });
	await expect(filter).toContainText('Good Characters');
	await page.getByRole('button', { name: 'Random', exact: true }).tap();
	const chosen = page.getByRole('list', { name: 'Chosen' });
	await expect(chosen.locator('[data-character-id]')).toHaveCount(3);
	// Good characters only by default.
	const ids = await chosen
		.locator('[data-character-id]')
		.evaluateAll((els) => els.map((el) => el.closest('[data-team]')?.getAttribute('data-team')));
	expect(ids).toEqual(['good', 'good', 'good']);
});

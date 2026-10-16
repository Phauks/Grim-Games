import { expect, test, type Page } from '@playwright/test';

// The info-token sheet the grimoire board opens from its header (Trevor, 2026-10-16).

async function openSheet(page: Page, name = 'Info tokens') {
	await page.goto('/spikes/info-tokens');
	await page.getByRole('button', { name, exact: true }).tap();
	await expect(page.getByRole('button', { name: 'This is the Demon' })).toBeVisible();
}

const shown = (page: Page) => page.locator('[data-testid="show-to-player"][open]');

test('"This is the Demon" is shown at once, for the Storyteller to point', async ({ page }) => {
	await openSheet(page);
	await page.getByRole('searchbox', { name: 'Search info tokens' }).fill('demon');
	await expect(page.getByRole('button', { name: 'Did you vote today?' })).toHaveCount(0);
	await page.getByRole('button', { name: 'This is the Demon' }).tap();
	await expect(shown(page).getByRole('heading')).toHaveText('This is the Demon');
	await shown(page).getByRole('button', { name: 'Close' }).tap();
	// The sheet comes back, at the list, for the next card.
	await expect(page.getByRole('button', { name: 'This is the Demon' })).toBeVisible();
});

test('"not in play" with no bluffs yet opens the bluff picker', async ({ page }) => {
	await openSheet(page);
	await page.getByRole('button', { name: 'These characters are not in play' }).tap();
	await expect(page.getByTestId('bluff-picker')).toHaveText('Bluff picker opened');
});

test('"not in play" asks which bluff set when there are several', async ({ page }) => {
	await openSheet(page, 'Info tokens (two bluff sets)');
	await page.getByRole('button', { name: 'These characters are not in play' }).tap();
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
	await page.getByRole('button', { name: 'Show' }).tap();
	await expect(shown(page).getByRole('img', { name: /Empath token/ })).toBeVisible();
	await shown(page).getByRole('button', { name: 'Close' }).tap();

	await page.getByRole('button', { name: 'Add info token' }).tap();
	await page.getByRole('textbox', { name: 'Text' }).fill('You are **cursed**');
	await page.getByRole('button', { name: 'Save' }).tap();
	await page.getByRole('button', { name: 'Edit You are cursed' }).tap();
	await page.getByRole('textbox', { name: 'Text' }).fill('You are **hexed**');
	await page.getByRole('button', { name: 'Save' }).tap();
	await page.getByRole('button', { name: 'You are hexed', exact: true }).tap();
	await expect(shown(page).locator('strong')).toHaveText('hexed');
	await shown(page).getByRole('button', { name: 'Close' }).tap();

	await page.getByRole('button', { name: 'Delete You are hexed' }).tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).tap();
	await expect(page.getByRole('button', { name: 'You are hexed', exact: true })).toHaveCount(0);
	// No Undo on the info screens (Trevor, 2026-10-16): the confirm is the safeguard.
	await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
});

test('a chain of cards can be reordered and is shown together', async ({ page }) => {
	await openSheet(page);
	// A madness card of the Storyteller's own that asks for a character.
	await page.getByRole('button', { name: 'Add info token' }).tap();
	await page.getByRole('textbox', { name: 'Text' }).fill('You are **mad** that you are');
	await page.getByText('Show with characters').tap();
	await page.getByRole('button', { name: 'Save' }).tap();

	await page
		.getByRole('radiogroup', { name: 'How cards are shown' })
		.getByText('Chain', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'You are mad that you are', exact: true }).tap();
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Empath');
	await page.getByRole('button', { name: 'Empath', exact: true }).tap();
	await page.getByRole('button', { name: 'Add', exact: true }).tap();
	await page.getByRole('button', { name: 'This character selected you' }).tap();
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Chef');
	await page.getByRole('button', { name: 'Chef', exact: true }).tap();
	await page.getByRole('button', { name: 'Add', exact: true }).tap();

	// Added in the wrong order, then moved up.
	const list = page.getByTestId('chain-list');
	await expect(list.getByRole('listitem').first()).toContainText('1. You are mad that you are');
	await expect(
		list.getByRole('button', { name: /^Move You are mad that you are .* up$/ })
	).toBeDisabled();
	await list.getByRole('button', { name: /^Move This character selected you .* up$/ }).tap();
	await expect(list.getByRole('listitem').first()).toContainText(
		'1. This character selected you (Chef)'
	);
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
	await page.getByRole('button', { name: 'This is the Demon' }).tap();
	await page.getByRole('button', { name: 'These are your Minions' }).tap();
	await page.getByRole('button', { name: 'Show 4 cards' }).tap();
	await expect(view.getByRole('region', { name: 'Card 1 of 4' })).toBeInViewport();
	await view.getByRole('button', { name: 'Next card' }).tap();
	await expect(view.getByRole('region', { name: 'Card 2 of 4' })).toBeInViewport();
	await view.getByRole('button', { name: 'Close' }).tap();

	// The red bin clears the chain.
	await page.getByRole('button', { name: 'Clear the chain' }).tap();
	await expect(page.getByTestId('chain-list')).toHaveCount(0);
});

test('character cards load only for characters on the script', async ({ page }) => {
	// Trouble Brewing has no Mezepheles, so there is no secret word card.
	await openSheet(page);
	await expect(
		page
			.getByRole('dialog', { name: 'Info tokens' })
			.getByRole('button', { name: 'Characters', exact: true })
	).toBeVisible();
	await expect(page.getByRole('button', { name: /^Secret word/ })).toHaveCount(0);
});

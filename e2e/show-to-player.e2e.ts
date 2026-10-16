import { expect, test } from '@playwright/test';

test('an info token is shown full screen and only the close button hides it', async ({ page }) => {
	await page.goto('/info-tokens');
	await page.getByRole('button', { name: 'Did you vote today?' }).tap();

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
	await page.getByRole('button', { name: 'You are' }).tap();
	await page.getByRole('searchbox', { name: 'Search characters' }).fill('Empath');
	await page.getByRole('button', { name: 'Empath', exact: true }).tap();
	await page.getByRole('button', { name: 'Show' }).tap();

	const shown = page.getByTestId('show-to-player');
	await expect(shown.getByRole('heading')).toHaveText('You are');
	await expect(shown.getByRole('img', { name: /Empath token/ })).toBeVisible();
	await expect(shown).toContainText('Each night, you learn how many of your 2 alive neighbors');
});

test('a custom info token keeps its bold words and survives a reload', async ({ page }) => {
	await page.goto('/info-tokens');
	await page.getByRole('button', { name: 'Add info token' }).tap();
	await page.getByRole('textbox', { name: 'Text' }).fill('You are **mad** about something');
	await page.getByRole('button', { name: 'Save' }).tap();

	await page.reload();
	const card = page.getByRole('button', { name: 'You are mad about something', exact: true });
	await expect(card.locator('strong')).toHaveText('mad');
	await card.tap();
	await expect(page.getByTestId('show-to-player').locator('strong')).toHaveText('mad');
	await page.getByTestId('show-to-player').getByRole('button', { name: 'Close' }).tap();

	await page.getByRole('button', { name: 'Edit You are mad about something' }).tap();
	await page.getByRole('button', { name: 'Delete' }).tap();
	await expect(page.getByText('You are mad about something')).toHaveCount(0);
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
	await page.getByRole('button', { name: 'Save' }).tap();

	const set = page.getByTestId('bluff-set');
	await expect(set).toContainText('Investigator');
	await set.getByRole('button', { name: 'Show' }).tap();
	// The open one: the Lunatic sample on the same page has its own (closed) player view.
	const shown = page.locator('[data-testid="show-to-player"][open]');
	await expect(shown.getByRole('heading')).toHaveText('These characters are not in play');
	// A list with abilities, not tokens.
	await expect(shown.getByRole('listitem')).toHaveCount(3);
	await expect(shown).toContainText('Each night*, choose a player');
	await shown.getByRole('button', { name: 'Close' }).tap();
	await expect(page.getByRole('dialog', { name: 'Demon bluffs' })).toBeVisible();
});

test("characters in play can't be Demon bluffs, but the Drunk's Townsfolk can", async ({
	page
}) => {
	await page.goto('/spikes/bluffs');
	await page.getByRole('button', { name: 'Demon bluffs', exact: true }).tap();
	await page.getByRole('button', { name: 'Choose' }).tap();
	await expect(choice(page, 'Empath')).toBeDisabled();
	await expect(choice(page, 'Empath')).toContainText('In play');
	// The Chef's seat is the Drunk (wiki: Drunk), so the Chef is not in play.
	await expect(choice(page, 'Chef')).toBeEnabled();
	await choice(page, 'Chef').tap();
	await page.getByRole('button', { name: 'Save' }).tap();
	await expect(page.getByTestId('bluff-set')).toContainText('Chef');
});

test('a Lunatic game adds an optional Lunatic set that may include characters in play', async ({
	page
}) => {
	await page.goto('/spikes/bluffs');
	await page.getByRole('button', { name: 'Demon bluffs (Lunatic game)' }).tap();
	await expect(page.getByTestId('bluff-set')).toHaveCount(2);
	const lunatic = page.locator('[data-testid="bluff-set"][data-set="Lunatic"]');
	await lunatic.getByRole('button', { name: 'Choose' }).tap();
	await expect(choice(page, 'Sailor')).toBeEnabled();
	await expect(choice(page, 'Sailor')).toContainText('In play');
	await choice(page, 'Sailor').tap();
	await page.getByRole('button', { name: 'Save' }).tap();
	await expect(lunatic).toContainText('Sailor');
	await expect(lunatic).not.toContainText('In play: replace');
});

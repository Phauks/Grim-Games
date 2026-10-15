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
	await page.getByRole('searchbox', { name: 'Find a character' }).fill('Empath');
	await page.getByRole('button', { name: /^Empath token/ }).tap();
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

test('the Storyteller sets all 3 Demon bluffs at once and shows them', async ({ page }) => {
	await page.goto('/spikes/bluffs');
	await page.getByRole('button', { name: 'Demon bluffs' }).tap();
	await page.getByRole('button', { name: 'Choose' }).tap();

	for (const name of ['Investigator', 'Monk', 'Saint']) {
		await page.getByRole('button', { name: new RegExp(`^${name} token`) }).tap();
	}
	// Full: a fourth character can't be added.
	await expect(page.getByRole('button', { name: /^Librarian token/ })).toBeDisabled();
	await page.getByRole('button', { name: 'Save' }).tap();

	const set = page.getByTestId('bluff-set');
	await expect(set).toContainText('Investigator');
	await expect(set).toContainText('Saint');

	await set.getByRole('button', { name: 'Show' }).tap();
	const shown = page.getByTestId('show-to-player');
	await expect(shown.getByRole('heading')).toHaveText('These characters are not in play');
	await expect(shown.getByRole('img')).toHaveCount(3);
	await shown.getByRole('button', { name: 'Close' }).tap();
	await expect(shown).toBeHidden();
	// Back to the sheet the Storyteller was in.
	await expect(page.getByRole('dialog', { name: 'Demon bluffs' })).toBeVisible();
});

test('a bluff that is in play is marked and still allowed, with a note', async ({ page }) => {
	await page.goto('/spikes/bluffs');
	await page.getByRole('button', { name: 'Demon bluffs' }).tap();
	await page.getByRole('button', { name: 'Choose' }).tap();
	const empath = page.getByRole('button', { name: /^Empath token/ });
	await expect(empath).toContainText('In play');
	await empath.tap();
	await page.getByRole('button', { name: 'Save' }).tap();
	await expect(page.getByText('Empath is in play')).toBeVisible();
});

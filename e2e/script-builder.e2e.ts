import { expect, test, type Page } from '@playwright/test';

// The Script builder in Prepare (Trevor, 2026-10-16): pick official characters, see the
// script check (jinxed pairs, no Djinn line: Trevor 2026-10-17), save into the saved scripts New game uses.

function character(page: Page, name: string) {
	return page.getByTestId('character-picker').getByRole('button', { name, exact: true });
}

test('builds, checks and saves a script that New game can use', async ({ page }) => {
	await page.goto('/build-script');
	await expect(page.getByRole('heading', { name: 'Script builder', level: 1 })).toBeVisible();
	const save = page.getByRole('button', { name: 'Save', exact: true });
	await expect(save).toBeDisabled();

	await page.getByRole('textbox', { name: 'Name' }).fill('Builder test');
	await page.getByRole('textbox', { name: 'Author' }).fill('Trevor');
	for (const name of ['Chef', 'Spy', 'Magician', 'Imp']) await character(page, name).tap();
	await expect(character(page, 'Chef')).toHaveAttribute('aria-pressed', 'true');
	// The Magician is a Townsfolk, the Spy a Minion.
	await expect(page.getByTestId('count-townsfolk')).toHaveText('2');
	await expect(page.getByTestId('count-minion')).toHaveText('1');
	await expect(page.getByTestId('count-demon')).toHaveText('1');

	// Spy and Magician are jinxed: the check lists the pair.
	const check = page.getByTestId('builder-check');
	await expect(check.getByTestId('jinx-count')).toHaveText('1');

	await save.tap();
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();

	// The draft stays on the device, and the saved script is offered when starting a game.
	await page.reload();
	await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Builder test');
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
	await page.goto('/new');
	await expect(
		page.getByRole('radiogroup', { name: 'Script' }).getByText('Builder test')
	).toBeVisible();
});

test('offers the character another needs, and clearing confirms', async ({ page }) => {
	await page.goto('/build-script');
	await character(page, 'Choirboy').tap();
	const check = page.getByTestId('builder-check');
	await check.getByRole('button', { name: 'Add', exact: true }).tap();
	await expect(character(page, 'King')).toHaveAttribute('aria-pressed', 'true');

	await page.getByRole('button', { name: 'Clear the script' }).tap();
	const confirm = page.getByRole('alertdialog', { name: 'Clear the script?' });
	await confirm.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('count-townsfolk')).toHaveText('0');
	await expect(page.getByRole('button', { name: 'Clear the script' })).toBeDisabled();
});

test('opens a saved script to edit it', async ({ page }) => {
	await page.goto('/build-script');
	await page.getByRole('textbox', { name: 'Name' }).fill('Reopen me');
	for (const name of ['Chef', 'Imp']) await character(page, name).tap();
	await page.getByRole('button', { name: 'Save', exact: true }).tap();
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Clear the script' }).tap();
	await page
		.getByRole('alertdialog', { name: 'Clear the script?' })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(page.getByTestId('count-demon')).toHaveText('0');

	await page.getByRole('button', { name: 'Open a saved script' }).tap();
	await page.getByRole('dialog', { name: 'Open a saved script' }).getByText('Reopen me').tap();
	await expect(page.getByTestId('count-townsfolk')).toHaveText('1');
	await expect(page.getByTestId('count-demon')).toHaveText('1');
	await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Reopen me');
	// Still the same saved script, so nothing new to save.
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
});

import { expect, test } from '@playwright/test';

// The Character builder in Prepare (Trevor, 2026-10-17): make a homebrew character, save it on
// the device, find it in the Library, and put it on a script with the Script builder.

test('makes a character, saves it, and puts it on a script', async ({ page }) => {
	await page.goto('/build-character');
	await expect(page.getByRole('heading', { name: 'Character builder', level: 1 })).toBeVisible();
	const save = page.getByRole('button', { name: 'Save', exact: true });
	await expect(save).toBeDisabled();
	await expect(page.getByRole('status', { name: 'To save' })).toContainText('It needs a name.');

	await page.getByTestId('character-name').fill('Lamp Lighter');
	await page.getByTestId('character-ability').fill('Each night, learn something. [+1 Outsider]');
	await page.getByRole('combobox', { name: 'Character type' }).tap();
	await page.getByRole('option', { name: 'Minion', exact: true }).tap();
	// Bracketed text changes setup unless switched off.
	await expect(
		page.getByRole('checkbox', { name: 'Changes setup', includeHidden: true })
	).toBeChecked();
	await page.getByTestId('reminders').getByRole('button', { name: 'Add a reminder' }).tap();
	await page.getByRole('textbox', { name: 'Reminder 1' }).first().fill('Lit');
	await expect(page.getByTestId('preview')).toContainText('Lit');

	await save.tap();
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();

	// The draft stays on the device.
	await page.reload();
	await expect(page.getByTestId('character-name')).toHaveValue('Lamp Lighter');
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Add to Script builder' }).tap();
	await expect(page.getByRole('button', { name: 'On Script builder' })).toBeDisabled();
	await page.goto('/build-script');
	await expect(page.getByTestId('count-minion')).toHaveText('1');
	await expect(page.getByTestId('homebrew-count')).toHaveText('1');

	await page.goto('/library');
	await page.getByTestId('library-characters').getByRole('link').first().tap();
	await expect(page).toHaveURL(/\/build-character$/);
	await expect(page.getByTestId('character-name')).toHaveValue('Lamp Lighter');
});

test('the Script builder lists saved characters under My characters', async ({ page }) => {
	await page.goto('/build-character');
	await page.getByTestId('character-name').fill('Bell Ringer');
	await page.getByTestId('character-ability').fill('You start knowing a bell.');
	await page.getByRole('button', { name: 'Save', exact: true }).tap();

	await page.goto('/build-script');
	await page.getByRole('combobox', { name: 'Characters from' }).tap();
	await page.getByRole('option', { name: 'My characters', exact: true }).tap();
	await page
		.getByTestId('character-picker')
		.getByRole('button', { name: 'Bell Ringer', exact: true })
		.tap();
	await expect(page.getByTestId('count-townsfolk')).toHaveText('1');
});

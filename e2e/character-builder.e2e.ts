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
	await page
		.getByTestId('library-table')
		.getByRole('button', { name: /^Lamp Lighter/ })
		.tap();
	await page.getByRole('button', { name: 'Edit character' }).tap();
	await expect(
		page.getByRole('dialog', { name: 'Edit character' }).getByTestId('character-name')
	).toHaveValue('Lamp Lighter');
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

// Abilities from standard parts (Trevor, 2026-10-18): the Sort Order opening, then setup
// changes built clause by clause, including a linked character as the Choirboy needs the King.
test('an ability is built from its opening and setup changes', async ({ page }) => {
	await page.goto('/build-character');
	await page.getByTestId('character-name').fill('Herald');
	const ability = page.getByTestId('character-ability');
	await ability.fill('choose a player: they learn something.');

	await page.getByRole('combobox', { name: 'Opens with' }).tap();
	await page.getByRole('option', { name: 'Each night*', exact: true }).tap();
	await expect(ability).toHaveValue('Each night* choose a player: they learn something.');

	const parts = page.getByTestId('setup-parts');
	await expect(parts).toContainText('None');
	const add = page.getByRole('button', { name: 'Add a setup change' });
	await add.tap();
	let dialog = page.getByRole('dialog', { name: 'Add a setup change' });
	await dialog.getByRole('button', { name: 'Higher number' }).tap();
	await expect(dialog.getByTestId('setup-part-preview')).toHaveText('[+2 Outsiders]');
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(ability).toHaveValue(
		'Each night* choose a player: they learn something. [+2 Outsiders]'
	);

	await add.tap();
	dialog = page.getByRole('dialog', { name: 'Add a setup change' });
	await dialog.getByRole('combobox', { name: 'Change' }).tap();
	await page.getByRole('option', { name: 'Another character in play', exact: true }).tap();
	await expect(dialog.getByRole('button', { name: 'Confirm' })).toBeDisabled();
	await dialog.getByRole('button', { name: 'Choose a character' }).tap();
	const picker = page.getByRole('dialog', { name: 'Choose a character' });
	await picker.getByRole('button', { name: 'King', exact: true }).tap();
	await expect(dialog.getByTestId('setup-part-preview')).toHaveText('[+the King]');
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(ability).toHaveValue(
		'Each night* choose a player: they learn something. [+2 Outsiders. +the King]'
	);
	await expect(
		page.getByRole('checkbox', { name: 'Changes setup', includeHidden: true })
	).toBeChecked();

	await parts.getByRole('button', { name: 'Remove +2 Outsiders' }).tap();
	await expect(ability).toHaveValue(
		'Each night* choose a player: they learn something. [+the King]'
	);
});

// One trash in the header (Trevor, 2026-10-18: "two delete buttons"): it clears an unsaved
// character, and deletes the saved one once there is one.
test('one trash button clears a new character and deletes a saved one', async ({ page }) => {
	await page.goto('/build-character');
	const header = page.getByRole('main');
	const trash = () =>
		header.getByRole('button', { name: /^(Clear the character|Delete the saved character)$/ });
	await expect(trash()).toHaveCount(1);
	await expect(header.getByRole('button', { name: 'Clear the character' })).toBeDisabled();

	await page.getByTestId('character-name').fill('Candle Snuffer');
	await page.getByTestId('character-ability').fill('You start knowing a candle.');
	await page.getByRole('button', { name: 'Save', exact: true }).tap();
	await expect(trash()).toHaveCount(1);
	await header.getByRole('button', { name: 'Delete the saved character' }).tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();

	await header.getByRole('button', { name: 'Clear the character' }).tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('character-name')).toHaveValue('');
});

// The clauses official abilities use most, after the opening (Trevor, 2026-10-18): who is
// chosen and what then happens, each written in TPI's words; typed text around them stays.
test('an ability gets who it chooses and what happens from drop-downs', async ({ page }) => {
	await page.goto('/build-character');
	const ability = page.getByTestId('character-ability');
	await ability.fill('Each night*, you learn a number.');
	await expect(page.getByRole('combobox', { name: 'Then' })).toContainText('you learn');

	await page.getByRole('combobox', { name: 'Chooses' }).tap();
	await page.getByRole('option', { name: 'choose a player (not yourself)', exact: true }).tap();
	await expect(ability).toHaveValue(
		'Each night*, choose a player (not yourself): you learn a number.'
	);

	await page.getByRole('combobox', { name: 'Then' }).tap();
	await page.getByRole('option', { name: 'they are poisoned', exact: true }).tap();
	await expect(ability).toHaveValue(
		'Each night*, choose a player (not yourself): they are poisoned a number.'
	);
});

// Character collections from the builder (Trevor, 2026-10-18: "in character builder, allow
// assigning to character collection"): the Library's own collections, shown once saved.
test('a saved character goes into a new character collection', async ({ page }) => {
	await page.goto('/build-character');
	const collections = page.getByRole('combobox', { name: 'Character collections' });
	await expect(collections).toBeDisabled();
	await expect(collections).toContainText('None');

	await page.getByTestId('character-name').fill('Lantern Keeper');
	await page.getByTestId('character-ability').fill('You start knowing a lantern.');
	await page.getByRole('button', { name: 'Save', exact: true }).tap();
	await expect(collections).toBeEnabled();

	await collections.tap();
	await page.getByRole('option', { name: 'New collection', exact: true }).tap();
	const naming = page.getByRole('dialog', { name: 'New collection' });
	await naming.getByRole('textbox').fill('Lights');
	await naming.getByRole('textbox').press('Enter');
	await expect(collections).toContainText('Lights');

	// Unticking takes it out again.
	await collections.tap();
	await page.getByRole('option', { name: 'Lights', exact: true }).tap();
	await page.keyboard.press('Escape');
	await expect(collections).toContainText('None');
});

// The Character builder over the Script builder (Trevor, 2026-10-18: "open that page as a
// modal so we don't move away"): a new character goes on the script, an edit replaces it, and
// Cancel asks before throwing changes away.
test('the Script builder builds and edits a character without leaving', async ({ page }) => {
	await page.goto('/build-script');
	await page.getByRole('button', { name: 'New character', exact: true }).tap();
	let builder = page.getByRole('dialog', { name: 'New character' });
	await builder.getByTestId('character-name').fill('Moth Keeper');
	await builder.getByTestId('character-ability').fill('You start knowing a moth.');
	await builder.getByRole('button', { name: 'Confirm' }).tap();
	await expect(builder).toBeHidden();
	await expect(page).toHaveURL(/\/build-script$/);
	await expect(page.getByTestId('homebrew-count')).toHaveText('1');
	await expect(page.getByTestId('count-townsfolk')).toHaveText('1');

	await page.getByRole('button', { name: 'Edit Moth Keeper' }).tap();
	builder = page.getByRole('dialog', { name: 'Edit character' });
	await expect(builder.getByTestId('character-name')).toHaveValue('Moth Keeper');
	await builder.getByTestId('character-name').fill('Moth Warden');
	await builder.getByRole('button', { name: 'Cancel' }).tap();
	const discard = page.getByRole('alertdialog', { name: 'Discard changes?' });
	await discard.getByRole('button', { name: 'Cancel' }).tap();
	await expect(builder.getByTestId('character-name')).toHaveValue('Moth Warden');
	// Escape asks the same question, and the builder stays open.
	await page.keyboard.press('Escape');
	await discard.getByRole('button', { name: 'Cancel' }).tap();
	await expect(builder.getByTestId('character-name')).toHaveValue('Moth Warden');
	await builder.getByRole('button', { name: 'Confirm' }).tap();
	await expect(builder).toBeHidden();
	await expect(page.getByRole('button', { name: 'Edit Moth Warden' })).toBeVisible();
	await expect(page.getByTestId('homebrew-count')).toHaveText('1');

	// The page's own draft is untouched.
	await page.goto('/build-character');
	await expect(page.getByTestId('character-name')).toHaveValue('');
});

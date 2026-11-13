import { expect, test } from '@playwright/test';
import { pickNumber } from './number-select.ts';
import { openTab } from './tabs.ts';

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
	// One tap selects, a double tap opens (Trevor, 2026-10-18).
	const lamp = page.getByTestId('library-table').getByRole('button', { name: /^Lamp Lighter/ });
	await lamp.tap();
	await lamp.tap();
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
	await pickNumber(dialog, 'Number', 2);
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
	const newCharacter = page.getByRole('button', { name: 'New character', exact: true });
	// In the header's controls with Save (Trevor, 2026-10-18), not a line in the builder: the
	// controls may wrap on a phone, but all sit above the character search.
	const name = (await page.getByRole('searchbox', { name: 'Search characters' }).boundingBox())!;
	const box = (await newCharacter.boundingBox())!;
	expect(box.y + box.height).toBeLessThanOrEqual(name.y);
	await newCharacter.tap();
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

// Like the Script builder (Trevor, 2026-10-18): Save sits in the header, and Download shows
// the character's JSON first, with Copy and Download.
test('Save is in the header and Download shows the JSON first', async ({ page }) => {
	await page.goto('/build-character');
	await page.getByTestId('character-name').fill('Wick Trimmer');
	await page.getByTestId('character-ability').fill('You start knowing a wick.');
	await page.getByRole('main').getByRole('button', { name: 'Save', exact: true }).tap();
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();

	await page.getByRole('button', { name: 'Download character JSON' }).tap();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByTestId('builder-json')).toContainText('Wick Trimmer');
	await expect(dialog.getByRole('button', { name: 'Copy JSON' })).toBeVisible();
	const download = page.waitForEvent('download');
	await dialog.getByRole('button', { name: 'Download character JSON' }).tap();
	expect((await download).suggestedFilename()).toBe('wick-trimmer.json');
});

// Where a custom character wakes (M59, Trevor 2026-11-06: mockup C): the night's stages in
// order; the open one shows its characters with this one in its place.
test('picks where a character wakes from the night stages', async ({ page }) => {
	await page.goto('/build-character');
	await page.getByTestId('character-name').fill('Night Guard');
	await page
		.getByTestId('character-ability')
		.fill('Each night*, choose a player (not yourself): they are safe from the Demon tonight.');
	// The night has its own tab (M82).
	await page.getByRole('tab', { name: 'Night' }).tap();
	const other = page.getByTestId('night-place-other');
	const stage = (name: string) => other.getByRole('button', { name: new RegExp(`^${name}`) });
	// It doesn't wake without night text.
	await expect(stage('Minions')).toBeDisabled();

	await page.getByRole('textbox', { name: 'Other nights text' }).fill('Wake the Night Guard.');
	// Placed from its ability until a place is picked.
	await expect(stage('Poison and protection')).toHaveAttribute('aria-expanded', 'true');

	// Another stage opens in a sheet.
	await stage('Minions').tap();
	const sheet = page.getByRole('dialog', { name: 'Minions' });
	await sheet.getByRole('button', { name: 'Start of the stage' }).tap();
	await expect(sheet).toBeHidden();
	await expect(stage('Minions')).toHaveAttribute('aria-expanded', 'true');
	await expect(stage('Poison and protection')).toHaveAttribute('aria-expanded', 'false');
	const steps = other.locator('ol ol > li');
	await expect(steps.first()).toContainText('Night Guard');

	// Tapping a character in the open stage puts it right after that one.
	const second = steps.nth(1);
	const name = (await second.innerText()).trim();
	await second.getByRole('button').tap();
	await expect(steps.nth(1)).toContainText('Night Guard');
	await expect(steps.first()).toContainText(name);

	// It is saved with the character.
	await page.reload();
	await page.getByRole('tab', { name: 'Night' }).tap();
	await expect(stage('Minions')).toHaveAttribute('aria-expanded', 'true');
	await page.getByRole('button', { name: 'Download character JSON' }).tap();
	await expect(page.getByRole('dialog').getByTestId('builder-json')).toContainText('"minions"');
});

// A Rules section (M62, Trevor picked "Add a rule", 2026-11-09): rules are added one at a time,
// found by name or under their group's tab (M80), and filled in with fields made for each rule, or written as rules text, each
// checked as a script would load it; a row's ⋯ changes or removes it.
test('rules are added, changed and removed one at a time', async ({ page }) => {
	await page.goto('/build-character');
	await page.getByTestId('character-name').fill('Lamplighter');
	await page.getByTestId('character-ability').fill('Each night*, choose a player: they can’t die.');
	await page.getByTestId('reminders').getByRole('button', { name: 'Add a reminder' }).tap();
	await page.getByRole('textbox', { name: 'Reminder 1' }).first().fill('Lit');

	// The rules have their own tab, which counts them (M82).
	const rulesTab = page.getByRole('tab', { name: /^Rules/ });
	await expect(rulesTab).toHaveText('Rules · 0');
	await rulesTab.tap();
	const rules = page.getByTestId('rules');
	await expect(rules).toHaveText('None');

	// A rule with one reminder: its value is picked from the character's own reminders.
	await page.getByTestId('add-rule').tap();
	let dialog = page.getByRole('dialog', { name: 'Add a rule' });
	// Each group's tab lists its rules; Curses is about abilities, not the night.
	await openTab(page, 'Night');
	await expect(dialog.getByRole('tabpanel', { name: 'Night' })).not.toContainText('Curses');
	await openTab(page, 'Abilities');
	await dialog.getByRole('button', { name: /^Curses/ }).tap();
	await expect(dialog.getByRole('combobox', { name: 'Curses' })).toHaveText(/Lit/);
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(rules).toContainText('Curses');
	await expect(rules).toContainText('Lit');

	// A rule with several settings gets a field for each, checked as they are filled in.
	await page.getByTestId('add-rule').tap();
	dialog = page.getByRole('dialog', { name: 'Add a rule' });
	// The search finds a rule by any words of its name or description, in every group; a rule
	// the character has already is not offered again.
	const search = dialog.getByRole('searchbox', { name: 'Find a rule' });
	await search.fill('curse');
	await expect(dialog.getByTestId('rule-list')).toHaveText('None');
	await search.fill('kill');
	await dialog.getByRole('button', { name: /^Kills/ }).tap();
	// The picked rule's row goes back to finding another.
	await dialog.getByRole('button', { name: 'Pick another rule instead of Kills' }).tap();
	await search.fill('protect');
	await dialog.getByRole('button', { name: /^Protects/ }).tap();
	const confirm = dialog.getByRole('button', { name: 'Confirm' });
	await expect(confirm).toBeDisabled();
	await dialog.getByRole('combobox', { name: 'Who' }).tap();
	await page.getByRole('option', { name: 'marked', exact: true }).tap();
	await dialog.getByRole('combobox', { name: 'Reminder', exact: true }).tap();
	await page.getByRole('option', { name: 'Lit', exact: true }).tap();
	await dialog.getByRole('combobox', { name: 'From' }).tap();
	await page.getByRole('option', { name: 'any', exact: true }).tap();
	await dialog.getByRole('checkbox', { name: 'Night', includeHidden: true }).check({ force: true });
	await expect(dialog.getByTestId('rule-problems')).toHaveText('');
	await confirm.tap();
	await expect(rules).toContainText('Who marked · Reminder Lit · From any · Night');
	await expect(rulesTab).toHaveText('Rules · 2');

	// Change: the ⋯ opens the rule with its settings; Rules text shows the same rule as text.
	await rules.getByRole('button', { name: 'Protects options' }).tap();
	await page.getByRole('menuitem', { name: 'Change' }).tap();
	dialog = page.getByRole('dialog', { name: 'Change a rule' });
	await expect(dialog.getByRole('combobox', { name: 'Who' })).toHaveText(/marked/);
	await dialog
		.getByRole('checkbox', { name: 'Rules text', includeHidden: true })
		.check({ force: true });
	const text = dialog.getByRole('textbox', { name: 'Rules text' });
	await expect(text).toHaveValue(/"night": true/);
	await text.fill('{ "who": "marked", "token": "Safe", "from": "any" }');
	await expect(dialog.getByTestId('rule-problems')).toContainText('rules.protects.token');
	await expect(dialog.getByRole('button', { name: 'Confirm' })).toBeDisabled();
	await dialog.getByRole('button', { name: 'Cancel' }).tap();

	// The rules go with the saved character and survive a reload.
	await page.reload();
	await rulesTab.tap();
	await expect(rules).toContainText('Protects');
	await rules.getByRole('button', { name: 'Curses options' }).tap();
	await page.getByRole('menuitem', { name: 'Remove' }).tap();
	await expect(rules).not.toContainText('Curses');
	await expect(rules).toContainText('Protects');
});

test('a jinx is built with its partner and effects as fields (M79)', async ({ page }) => {
	await page.goto('/build-character');
	await page.getByTestId('character-name').fill('Lamplighter');
	await page.getByTestId('character-ability').fill('Each night*, choose a player: they can’t die.');

	await page.getByRole('tab', { name: /^Rules/ }).tap();
	await page.getByTestId('add-rule').tap();
	const dialog = page.getByRole('dialog', { name: 'Add a rule' });
	await openTab(page, 'Setup');
	await dialog.getByRole('button', { name: /^Jinxes/ }).tap();

	// The partner is picked with the character picker, not typed as an id.
	await dialog.getByRole('button', { name: 'Add to Jinxes' }).tap();
	await page
		.getByRole('dialog', { name: 'Choose a character' })
		.getByRole('button', { name: 'Empath', exact: true })
		.tap();
	await expect(dialog.getByRole('button', { name: 'Change Empath' })).toBeVisible();

	// Effects are added one at a time from the jinx verbs, each with its own fields.
	await dialog.getByRole('combobox', { name: 'Add to Empath' }).tap();
	await page.getByRole('option', { name: 'Grimoire', exact: true }).tap();
	await expect(dialog.getByRole('combobox', { name: 'Grimoire', exact: true })).toHaveText(/all/);
	await expect(dialog.getByTestId('rule-problems')).toHaveText('');
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('rules')).toContainText('Empath Grimoire all');
});

test('a rule naming a character picks it, and asks for no words of ours (M84)', async ({
	page
}) => {
	await page.goto('/build-character');
	await page.getByTestId('character-name').fill('Lamplighter');
	await page.getByTestId('character-ability').fill('You might register as the Drunk.');
	await page.getByTestId('reminders').getByRole('button', { name: 'Add a reminder' }).tap();
	await page.getByRole('textbox', { name: 'Reminder 1' }).first().fill('Lit');

	await page.getByRole('tab', { name: /^Rules/ }).tap();

	// A hidden character is picked with the character picker, never typed as an id.
	await page.getByTestId('add-rule').tap();
	let dialog = page.getByRole('dialog', { name: 'Add a rule' });
	await dialog.getByRole('searchbox', { name: 'Find a rule' }).fill('hidden as');
	await dialog.getByRole('button', { name: /^Or hidden as/ }).tap();
	await expect(dialog.getByRole('textbox', { name: 'Or hidden as' })).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Choose a character' }).tap();
	await page
		.getByRole('dialog', { name: 'Choose a character' })
		.getByRole('button', { name: 'Drunk', exact: true })
		.tap();
	await dialog.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('rules')).toContainText('Or hidden as');
	await expect(page.getByTestId('rules')).toContainText('Drunk');

	// Setup preparation asks for the token and its player; the step's words are made from them.
	await page.getByTestId('add-rule').tap();
	dialog = page.getByRole('dialog', { name: 'Add a rule' });
	await dialog.getByRole('searchbox', { name: 'Find a rule' }).fill('setup preparation');
	await dialog.getByRole('button', { name: /^Setup preparation/ }).tap();
	await dialog.getByRole('button', { name: 'Add to Tokens to place' }).tap();
	await expect(dialog.getByRole('combobox', { name: 'Reminder', exact: true })).toBeVisible();
	await expect(dialog.getByRole('combobox', { name: 'On whom' })).toBeVisible();
	for (const words of ['Step text', 'Why', 'Hint'])
		await expect(dialog.getByRole('textbox', { name: words, exact: true })).toHaveCount(0);
});

import { expect, test } from '@playwright/test';

// The Mode builder in Prepare (Trevor, 2026-10-31: an interactive mode creator built from the
// format itself; he picked a form drawn from the format guide). Every part and field comes
// from the guide, the file is checked as it is made, and Save adds it to this device's own.

test('builds a special rule without JSON, saves it on this device, and shares it', async ({
	page
}) => {
	await page.goto('/build-mode');
	await expect(page.getByRole('heading', { name: 'Mode builder', level: 1 })).toBeVisible();
	const builder = page.getByTestId('mode-builder');
	const save = page.getByRole('button', { name: 'Save', exact: true });
	await expect(save).toBeDisabled();

	// Nothing to pick: the parts say what the file is (Trevor, 2026-11-01).
	await expect(builder.getByRole('combobox', { name: 'Makes' })).toHaveCount(0);
	await builder.getByRole('textbox', { name: /^Id/ }).fill('quiet-nights');
	await builder.getByRole('textbox', { name: /^Name/ }).fill('Quiet Nights');

	// A rule's own part, from the guide: its lines, added one at a time.
	const text = builder.locator('[data-part="text"]');
	await text.getByRole('button', { name: 'Add a line' }).tap();
	await text.getByRole('textbox', { name: 'Line 1' }).fill('Nobody talks at night.');

	// A part with kinds and fields: its own table, its settings usable while it is off.
	const deaths = builder.locator('[data-part="deaths"]');
	await expect(deaths).toHaveAttribute('data-off', '');
	await deaths.getByRole('checkbox', { includeHidden: true }).check({ force: true });
	await expect(deaths).not.toHaveAttribute('data-off');

	// The checker Add mode uses lists what is missing, always in view, with where it is.
	const problems = page.getByTestId('mode-builder-problems');
	const output = page.getByRole('tab', { name: /^Output/ });
	if (await output.isVisible()) await output.tap();
	await expect(problems).toHaveText(
		'parts.deaths.instructions the Storyteller runs this part, so say what they do'
	);
	await expect(save).toBeDisabled();
	// Tapping the problem goes to the setting: the part's Storyteller instructions.
	await problems.getByRole('button').tap();
	const instructions = deaths.locator('[data-note="instructions"]');
	await expect(instructions).toBeFocused();
	await instructions.tap();
	await page
		.getByTestId('mode-builder-note')
		.getByRole('textbox', { name: /^Storyteller instructions/ })
		.fill('Announce no deaths at dawn.');
	await page.keyboard.press('Escape');
	await expect(instructions).toHaveAttribute('data-set', '');
	if (await output.isVisible()) await output.tap();
	await expect(problems).toHaveText('None');
	// The output's JSON holds the part, and its lines go to its settings.
	await expect(page.getByTestId('mode-builder-json')).toContainText('"instructions": "Announce');
	await expect(page.getByTestId('mode-builder-kind')).toHaveText('Special rule');
	await expect(save).toBeEnabled();
	await save.tap();
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
	expect(await page.evaluate(() => localStorage.getItem('grim-games:custom-rules:v1'))).toContain(
		'quiet-nights'
	);
	// Shared like any mode file.
	await page.getByRole('button', { name: 'Share Quiet Nights' }).tap();
	await expect(
		page.getByRole('dialog', { name: 'Share Quiet Nights' }).getByTestId('share-url')
	).toHaveValue(/\/new#m=1\./);
});

// One format, auto-labelled (Trevor, 2026-11-01): a part that sets up the whole game makes the
// file a game mode, and Save files it with the game modes, which New game lists.
test('a file that deals the game is labelled a game mode and saved as one', async ({ page }) => {
	await page.goto('/build-mode');
	const builder = page.getByTestId('mode-builder');
	await builder.getByRole('textbox', { name: /^Id/ }).fill('dead-wake');
	await builder.getByRole('textbox', { name: /^Name/ }).fill('Dead Wake');
	const kind = page.getByTestId('mode-builder-kind');
	const output = page.getByRole('tab', { name: /^Output/ });
	const settings = page.getByRole('tab', { name: 'Settings' });
	if (await output.isVisible()) await output.tap();
	await expect(kind).toHaveText('Special rule');
	if (await settings.isVisible()) await settings.tap();
	await expect(builder.getByTestId('mode-builder-group-wholeGame')).toBeVisible();
	const assignment = builder.locator('[data-part="assignment"]');
	await assignment.getByRole('checkbox', { includeHidden: true }).check({ force: true });
	// A rule part on a game mode: the dead wake on the first night.
	const text = builder.locator('[data-part="text"]');
	await text.getByRole('button', { name: 'Add a line' }).tap();
	await text.getByRole('textbox', { name: 'Line 1' }).fill('The dead wake.');
	if (await output.isVisible()) await output.tap();
	await expect(kind).toHaveText(/^Game mode, because it sets /);
	await expect(page.getByTestId('mode-builder-problems')).toHaveText('None');
	await page.getByRole('button', { name: 'Save', exact: true }).tap();
	await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
	expect(await page.evaluate(() => localStorage.getItem('grim-games:custom-modes:v1'))).toContain(
		'dead-wake'
	);
	await page.goto('/new');
	const modes = page.getByRole('main').getByRole('combobox', { name: 'Game mode' });
	await modes.tap();
	await expect(page.getByRole('option', { name: 'Dead Wake', exact: true })).toBeVisible();
});

test('a problem keeps Save off and is listed with where it is', async ({ page }) => {
	await page.goto('/build-mode');
	const builder = page.getByTestId('mode-builder');
	await builder.getByRole('textbox', { name: /^Id/ }).fill('Bad Id');
	await builder.getByRole('textbox', { name: /^Name/ }).fill('Bad');
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
	const output = page.getByRole('tab', { name: /^Output · 1 problem/ });
	if (await output.isVisible()) await output.tap();
	await expect(page.getByTestId('mode-builder-problems')).toContainText('id must be lower-case');
});

test('changing a setting of a part that is off turns it on, and each setting links to the guide', async ({
	page
}) => {
	await page.goto('/build-mode');
	const builder = page.getByTestId('mode-builder');
	const pool = builder.locator('[data-part="pool"]');
	await expect(pool).toHaveAttribute('data-off', '');
	// Trevor, 2026-11-01: "while something is disabled, you should still be able to open the menus".
	await pool.getByRole('combobox', { name: /^Kind/ }).tap();
	await page.getByRole('option', { name: /^Every character/ }).tap();
	await expect(pool).not.toHaveAttribute('data-off');
	await expect(pool.getByRole('checkbox', { includeHidden: true })).toBeChecked();

	// The guide opens at the setting's own row.
	await builder.getByRole('button', { name: 'Guide: Name', exact: true }).tap();
	const guide = page.getByTestId('mode-guide');
	await expect(guide.locator('tr[data-target]')).toContainText('name');
	await expect(guide.locator('tr[data-target]')).toBeInViewport();
});

test('opens a built-in mode as a copy to start from', async ({ page }) => {
	await page.goto('/build-mode');
	await page.getByRole('button', { name: 'Open a mode or rule' }).tap();
	const open = page.getByTestId('saved-modes');
	await open.getByText('Whale Buffet', { exact: true }).tap();
	const builder = page.getByTestId('mode-builder');
	await expect(builder.getByRole('textbox', { name: /^Id/ })).toHaveValue(/-copy$/);
	await expect(builder.getByRole('textbox', { name: /^Name/ })).toHaveValue('Whale Buffet');
});

// Request feature (Trevor, 2026-11-01): the Report form opens as an enhancement request
// with what is on the builder as removable details.
test('Request feature opens the Report form with the mode being built', async ({ page }) => {
	await page.goto('/build-mode');
	const builder = page.getByTestId('mode-builder');
	await builder.getByRole('textbox', { name: /^Name/ }).fill('Moon Rules');
	// In the output beside the settings; on a phone, under the Output tab.
	const output = page.getByRole('tab', { name: /^Output/ });
	if (await output.isVisible()) await output.tap();
	await page.getByRole('button', { name: 'Request feature' }).tap();
	const form = page.getByTestId('report-form');
	await expect(form).toBeVisible();
	await expect(form.getByRole('combobox', { name: 'Kind' })).toContainText('Enhancement request');
	await expect(form.getByRole('textbox', { name: /^Title/ })).toHaveValue('Mode builder: ');
	await expect(form.locator('pre.details')).toContainText('Moon Rules', { useInnerText: false });
});

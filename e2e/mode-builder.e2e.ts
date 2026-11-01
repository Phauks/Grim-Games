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

	await builder.getByRole('combobox', { name: 'Makes' }).tap();
	await page.getByRole('option', { name: 'Special rule', exact: true }).tap();
	await builder.getByRole('textbox', { name: /^Id/ }).fill('quiet-nights');
	await builder.getByRole('textbox', { name: /^Name/ }).fill('Quiet Nights');

	// A rule's own part, from the guide: its lines, added one at a time.
	const text = builder.locator('[data-part="text"]');
	await text.getByRole('button', { name: 'Rule text', exact: true }).tap();
	await text.getByRole('button', { name: 'Add a line' }).tap();
	await text.getByRole('textbox', { name: 'Line 1' }).fill('Nobody talks at night.');

	// A part with kinds and fields: a switch, then its fields, drawn from the guide.
	const deaths = builder.locator('[data-part="deaths"]');
	await deaths.getByRole('checkbox', { includeHidden: true }).check({ force: true });

	// The checker Add mode uses says what is missing, with where it is.
	const problems = page.getByRole('button', { name: /^Problems/ });
	await problems.tap();
	await expect(page.getByTestId('mode-builder-problems')).toHaveText(
		'parts.deaths.instructions: the Storyteller runs this part, so say what they do'
	);
	await page.keyboard.press('Escape');
	await expect(save).toBeDisabled();
	await deaths.getByRole('button', { name: 'Deaths', exact: true }).tap();
	await deaths
		.getByRole('textbox', { name: /^Storyteller instructions/ })
		.fill('Announce no deaths at dawn.');
	await problems.tap();
	await expect(page.getByTestId('mode-builder-problems')).toHaveText('None');
	await page.keyboard.press('Escape');
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

test('a problem keeps Save off and is listed with where it is', async ({ page }) => {
	await page.goto('/build-mode');
	const builder = page.getByTestId('mode-builder');
	await builder.getByRole('textbox', { name: /^Id/ }).fill('Bad Id');
	await builder.getByRole('textbox', { name: /^Name/ }).fill('Bad');
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
	await page.getByRole('button', { name: /^Problems/ }).tap();
	await expect(page.getByTestId('mode-builder-problems')).toContainText('id: must be lower-case');
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

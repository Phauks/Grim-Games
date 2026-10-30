import { expect, test } from '@playwright/test';

// Bulleted and numbered lists in a note's text (Trevor, 2026-10-30): no buttons, a list starts
// when it is typed and Enter carries it on. Every titled note (game, player and notebook notes)
// uses the one editor, ui/notes/NoteEditor; the list rules are tested in core/text/lists.test.ts.

test.beforeEach(async ({ page }) => {
	await page.goto('/play');
	await page.getByRole('button', { name: 'Trouble Brewing' }).tap({ timeout: 15_000 });
	await page.getByRole('tab', { name: 'Notes' }).tap();
	await page.getByRole('button', { name: 'New note' }).tap();
});

test('a typed list carries on with Enter and ends on an empty item', async ({ page }) => {
	const sheet = page.getByRole('dialog', { name: 'Note' });
	const text = sheet.getByRole('textbox', { name: 'Text' });
	// No list buttons: typing the list is the way to start one.
	await expect(sheet.getByRole('button', { name: /list/i })).toHaveCount(0);

	await text.tap();
	await page.keyboard.type('- Ana claims Chef');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Ben claims Empath');
	await expect(text).toHaveValue('- Ana claims Chef\n- Ben claims Empath');

	// Enter on an empty item ends the list.
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Night 1');
	await expect(text).toHaveValue('- Ana claims Chef\n- Ben claims Empath\nNight 1');

	await page.keyboard.press('Enter');
	await page.keyboard.type('1) Poisoner');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Imp');
	await expect(text).toHaveValue(
		'- Ana claims Chef\n- Ben claims Empath\nNight 1\n1) Poisoner\n2) Imp'
	);

	// The list is the text itself, so the note's card shows it as written.
	await sheet.getByRole('textbox', { name: 'Title' }).fill('Claims');
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: /Claims\s*- Ana claims Chef/ })).toBeVisible();
});

import { expect, test } from '@playwright/test';

// Bulleted and numbered lists in a note's text (Trevor, 2026-10-30): the list buttons beside
// the text, and Enter carrying a list on. Every titled note (game, player and notebook notes)
// uses the one editor, ui/notes/NoteEditor; the list rules are tested in core/text/lists.test.ts.

test.beforeEach(async ({ page }) => {
	await page.goto('/play');
	await page.getByRole('button', { name: 'Trouble Brewing' }).tap({ timeout: 15_000 });
	await page.getByRole('tab', { name: 'Notes' }).tap();
	await page.getByRole('button', { name: 'New note' }).tap();
});

test('the list buttons start a list and Enter carries it on', async ({ page }) => {
	const sheet = page.getByRole('dialog', { name: 'Note' });
	const text = sheet.getByRole('textbox', { name: 'Text' });
	const bullets = sheet.getByRole('button', { name: 'Bulleted list' });
	const numbers = sheet.getByRole('button', { name: 'Numbered list' });
	await expect(bullets).toHaveAttribute('aria-pressed', 'false');

	await text.tap();
	await bullets.tap();
	// The button keeps the keyboard up: the field is still focused.
	await expect(text).toBeFocused();
	await expect(bullets).toHaveAttribute('aria-pressed', 'true');
	await page.keyboard.type('Ana claims Chef');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Ben claims Empath');
	await expect(text).toHaveValue('• Ana claims Chef\n• Ben claims Empath');

	// Enter on an empty item ends the list.
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Night 1');
	await expect(text).toHaveValue('• Ana claims Chef\n• Ben claims Empath\nNight 1');
	await expect(bullets).toHaveAttribute('aria-pressed', 'false');

	await page.keyboard.press('Enter');
	await numbers.tap();
	await page.keyboard.type('Poisoner');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Imp');
	await expect(text).toHaveValue(
		'• Ana claims Chef\n• Ben claims Empath\nNight 1\n1. Poisoner\n2. Imp'
	);
	await expect(numbers).toHaveAttribute('aria-pressed', 'true');

	// The list is the text itself, so the note's card shows it as written.
	await sheet.getByRole('textbox', { name: 'Title' }).fill('Claims');
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: /Claims\s*• Ana claims Chef/ })).toBeVisible();
});

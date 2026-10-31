import { expect, test, type Locator } from '@playwright/test';

// Bulleted and numbered lists in a note's text (Trevor, 2026-10-30): no buttons, a list starts
// when it is typed and Enter carries it on. Every titled note (game, player and notebook notes)
// uses the one editor, ui/notes/NoteEditor; the list rules are tested in core/text/lists.test.ts.
// Its text box is the rich one info cards use (Trevor, 2026-10-31), ui/primitives/RichTextField.

/** The words in a rich text box, a line break as "\n". */
const lines = (box: Locator) => () => box.evaluate((el) => (el as HTMLElement).innerText.trimEnd());

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
	await expect.poll(lines(text)).toBe('- Ana claims Chef\n- Ben claims Empath');

	// Enter on an empty item ends the list.
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Night 1');
	await expect.poll(lines(text)).toBe('- Ana claims Chef\n- Ben claims Empath\nNight 1');

	await page.keyboard.press('Enter');
	await page.keyboard.type('1) Poisoner');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Imp');
	await expect
		.poll(lines(text))
		.toBe('- Ana claims Chef\n- Ben claims Empath\nNight 1\n1) Poisoner\n2) Imp');

	// The list is the text itself, so the note's card shows it as written.
	await sheet.getByRole('textbox', { name: 'Title' }).fill('Claims');
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: /Claims\s*- Ana claims Chef/ })).toBeVisible();
});

test('a note has the same formatting tools as an info card', async ({ page }) => {
	const sheet = page.getByRole('dialog', { name: 'Note' });
	const text = sheet.getByRole('textbox', { name: 'Text' });
	await text.tap();
	await page.keyboard.type('Ana is ');
	await sheet.getByRole('button', { name: 'Bold' }).tap();
	await page.keyboard.type('evil');
	await expect(text.locator('strong, b')).toHaveText('evil');
	// The tools sit above the box, beside its label, never inside it.
	const tools = (await sheet.getByRole('toolbar').boundingBox())!;
	const box = (await text.boundingBox())!;
	expect(tools.y + tools.height).toBeLessThanOrEqual(box.y + 1);
	// The note's card shows the words, not the marks.
	await sheet.getByRole('textbox', { name: 'Title' }).fill('Ana');
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: /Ana\s*Ana is evil/ })).toBeVisible();
});

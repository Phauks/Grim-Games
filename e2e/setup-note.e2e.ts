import { expect, test } from '@playwright/test';
import { encodeSharedScript } from '../src/lib/features/scripts/share.ts';

test("a character's setup note sits on its own line, without brackets", async ({ page }) => {
	// Trevor (2026-11-06): the bracketed setup note gets its own line with a bar of the
	// character type's colour, in italics, and no symbol.
	// Enough characters that the script check stays closed.
	const shared = [
		{ id: '_meta', name: 'Setup Notes' },
		...['washerwoman', 'balloonist', 'huntsman', 'villageidiot', 'godfather', 'baron'],
		...['marionette', 'fanggu', 'lordoftyphon']
	];
	await page.goto(`/play#s=${await encodeSharedScript(shared)}`);

	const baron = page.locator('.ring-row[data-character-id="baron"]');
	const note = baron.getByTestId('setup-note');
	await expect(note).toHaveText('+2 Outsiders');
	await expect(baron.locator('.ring-ability')).not.toContainText('[');

	// Under the ability's first line, in italics, with a bar on its start side.
	const look = await note.evaluate((el) => {
		const style = getComputedStyle(el);
		return { italic: style.fontStyle, bar: parseFloat(style.borderInlineStartWidth) };
	});
	expect(look.italic).toBe('italic');
	expect(look.bar).toBeGreaterThan(0);

	// A character without a note has no setup line.
	await expect(
		page.locator('.ring-row[data-character-id="washerwoman"]').getByTestId('setup-note')
	).toHaveCount(0);
});

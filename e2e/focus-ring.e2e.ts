import { expect, test } from '@playwright/test';

// Trevor (2026-10-16): the Note title's focus ring showed as stray bars above and below the
// field, because the sheet's scroll box clipped a ring drawn outside the field.
test('a focused text field in a sheet draws one ring inside its own border', async ({ page }) => {
	await page.goto('/play');
	await page.getByRole('tab', { name: 'Notes' }).tap();
	await page.getByRole('button', { name: /^Untitled/ }).tap();
	const title = page.getByRole('dialog', { name: 'Note' }).getByRole('textbox', { name: 'Title' });
	await title.tap();
	await expect(title).toBeFocused();
	const ring = await title.evaluate((el) => {
		const style = getComputedStyle(el);
		return {
			width: parseFloat(style.outlineWidth),
			offset: parseFloat(style.outlineOffset),
			style: style.outlineStyle
		};
	});
	expect(ring.style).toBe('solid');
	expect(ring.width).toBeGreaterThan(0);
	// Drawn inside the border (offset of minus its width), so no parent can clip it.
	expect(ring.offset + ring.width).toBeLessThanOrEqual(0);
});

import { expect, test } from '@playwright/test';

// Every single-line text field has an X that clears it (Trevor, 2026-10-16); Esc clears
// too, and the X keeps its place (disabled) while the field is empty.
test('a text field clears with its X or Esc, keeping focus', async ({ page }) => {
	await page.goto('/reference');
	const search = page.getByRole('searchbox').first();
	const clear = page.getByRole('button', { name: 'Clear', exact: true }).first();
	await expect(clear).toBeDisabled();
	const before = await clear.boundingBox();
	await search.fill('Imp');
	await expect(clear).toBeEnabled();
	expect(await clear.boundingBox()).toEqual(before);
	await clear.tap();
	await expect(search).toHaveValue('');
	await expect(search).toBeFocused();
	await search.fill('Imp');
	await search.press('Escape');
	await expect(search).toHaveValue('');
});

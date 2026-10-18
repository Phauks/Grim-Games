import { expect, test } from '@playwright/test';

// With a mouse and keyboard: hover and focus effects show once, and never hide a control.
test.use({ viewport: { width: 1280, height: 720 }, hasTouch: false, isMobile: false });

// Hovering tints a control over its own fill. Replacing the fill made the Demon bluffs
// drop-down's light text vanish on the cream sheet (Trevor, 2026-10-18).
test('hovering a drop-down keeps its fill', async ({ page }) => {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.click();
	await page.getByRole('button', { name: 'Start game' }).click();
	await page.getByRole('button', { name: 'More', exact: true }).click();
	await page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'Demon bluffs' })
		.click();
	await page.getByRole('button', { name: 'Choose' }).first().click();

	const trigger = page.getByRole('combobox', { name: 'Characters' });
	const fill = () => trigger.evaluate((el) => getComputedStyle(el).backgroundColor);
	const before = await fill();
	await trigger.hover();
	await expect
		.poll(() => trigger.evaluate((el) => getComputedStyle(el).backgroundImage))
		.not.toBe('none');
	expect(await fill()).toBe(before);
});

// The search box draws one rounded ring; the input inside it drew a second, square one
// (Trevor, 2026-10-18: one effect, not two).
test('a focused search field shows one ring', async ({ page }) => {
	await page.goto('/scripts');
	const input = page.getByRole('searchbox').first();
	await input.click();
	await expect(input).toBeFocused();
	expect(await input.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none');
	expect(
		await input.evaluate((el) => getComputedStyle(el.closest('.search-field')!).boxShadow)
	).not.toBe('none');
});

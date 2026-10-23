import { expect, test } from '@playwright/test';

// Trevor (2026-10-16): built for phones, but on a computer it shouldn't feel like a phone app.

test.describe('on a computer (mouse, wide window)', () => {
	test.use({
		viewport: { width: 1440, height: 900 },
		isMobile: false,
		hasTouch: false,
		deviceScaleFactor: 1
	});

	test('a sheet opens as a centred panel with a Close button', async ({ page }) => {
		test.skip(test.info().project.name !== 'tablet', 'one desktop run is enough');
		// The info-token sheet stands in for every bottom sheet (notes open full screen now).
		await page.goto('/spikes/info-tokens');
		await page.getByRole('button', { name: 'Info tokens', exact: true }).click();
		const sheet = page.getByRole('dialog', { name: 'Info tokens' });
		await expect(sheet).toBeVisible();
		await page.waitForTimeout(400);
		const box = await sheet.boundingBox();
		const centre = (box?.x ?? 0) + (box?.width ?? 0) / 2;
		expect(Math.abs(centre - 720)).toBeLessThan(2);
		// Not stuck to the bottom of the window like a phone sheet.
		expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThan(900 - 8);

		await sheet.getByRole('button', { name: 'Close' }).click();
		await expect(sheet).toBeHidden();
	});

	test('buttons answer the mouse before they are clicked', async ({ page }) => {
		test.skip(test.info().project.name !== 'tablet', 'one desktop run is enough');
		await page.goto('/');
		const settings = page
			.getByRole('navigation', { name: 'Menu', exact: true })
			.getByRole('button', { name: 'Settings' });
		// The hover tint is layered over the button's own fill (base.css), so read both.
		const background = () =>
			settings.evaluate((el) => {
				const style = getComputedStyle(el);
				return `${style.backgroundColor} ${style.backgroundImage}`;
			});
		const before = await background();
		await settings.hover();
		await expect.poll(background).not.toBe(before);
	});
});

test('on a touch screen the sheet still slides up from the bottom, with no Close button', async ({
	page
}) => {
	await page.goto('/spikes/info-tokens');
	await page.getByRole('button', { name: 'Info tokens', exact: true }).tap();
	const sheet = page.getByRole('dialog', { name: 'Info tokens' });
	await expect(sheet).toBeVisible();
	await page.waitForTimeout(600);
	await expect(sheet.getByRole('button', { name: 'Close' })).toBeHidden();
	const box = await sheet.boundingBox();
	const height = page.viewportSize()?.height ?? 0;
	expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBeGreaterThanOrEqual(height - 1);
});

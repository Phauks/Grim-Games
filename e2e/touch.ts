import type { Page } from '@playwright/test';

/**
 * Drags one finger from `from` to `to` with real touch events (Chrome DevTools Protocol),
 * so pointer handlers see `pointerType: 'touch'` exactly as on a phone.
 */
export async function touchDrag(
	page: Page,
	from: { x: number; y: number },
	to: { x: number; y: number },
	{ steps = 12, stepDelay = 16 } = {}
): Promise<void> {
	const cdp = await page.context().newCDPSession(page);
	const point = (t: number) => ({
		x: from.x + (to.x - from.x) * t,
		y: from.y + (to.y - from.y) * t
	});
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(0)] });
	for (let step = 1; step <= steps; step++) {
		await page.waitForTimeout(stepDelay);
		await cdp.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [point(step / steps)]
		});
	}
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await cdp.detach();
}

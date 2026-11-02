import type { Page } from '@playwright/test';

// A character type's heading is a band that reaches out into the gutter (Collapsible), so a
// box that clips sideways with no room round it cuts the band's ends off.

/** Bands drawn wider than the boxes around them show, by heading. */
export async function clippedBands(page: Page): Promise<string[]> {
	await page.waitForFunction(() =>
		document.getAnimations().every((a) => a.playState !== 'running')
	);
	return page.evaluate(() => {
		const out: string[] = [];
		for (const band of document.querySelectorAll('[data-type-band]')) {
			const drawn = band.getBoundingClientRect();
			if (drawn.width < 2 || drawn.height < 2) continue;
			let left = drawn.left;
			let right = drawn.right;
			for (let box = band.parentElement; box; box = box.parentElement) {
				const style = getComputedStyle(box);
				if (style.overflowX === 'visible') continue;
				const shown = box.getBoundingClientRect();
				left = Math.max(left, shown.left + parseFloat(style.borderLeftWidth));
				right = Math.min(right, shown.right - parseFloat(style.borderRightWidth));
			}
			if (left > drawn.left + 0.5 || right < drawn.right - 0.5)
				out.push(
					`${band.textContent?.trim()}: ${Math.round(drawn.left)} to ${Math.round(drawn.right)}, shown ${Math.round(left)} to ${Math.round(right)}`
				);
		}
		return out;
	});
}

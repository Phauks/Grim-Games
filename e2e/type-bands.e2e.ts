import { expect, test, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';

// A character type's heading is a band that reaches out into the gutter (Collapsible), so a
// box that clips sideways with no room round it cut the band's ends off. Trevor (2026-11-01),
// on the board's Script view, sent the Townsfolk band with its ends cut and "still covered".
// This checks every band on screen is shown whole on each screen that lists characters by type.

/** Bands drawn wider than the boxes around them show, by heading. */
async function clippedBands(page: Page): Promise<string[]> {
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

test("a character type's band is shown whole wherever characters are listed by type", async ({
	page
}) => {
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await page.getByRole('button', { name: 'Create game' }).tap();

	// Character selection.
	await expect(page).toHaveURL(/\/setup$/);
	await page.getByRole('button', { name: 'Townsfolk', exact: true }).scrollIntoViewIfNeeded();
	expect(await clippedBands(page)).toEqual([]);
	await toBoard(page);

	// The board's Script view.
	await page.getByRole('button', { name: 'Script', exact: true }).tap();
	const script = page.getByRole('dialog', { name: 'Trouble Brewing' });
	await expect(script.getByRole('button', { name: 'Townsfolk', exact: true })).toBeVisible();
	expect(await clippedBands(page)).toEqual([]);
	await page.keyboard.press('Escape');
	await expect(script).toBeHidden();

	// The grim cover's Player view.
	await page.getByTestId('cover-button').tap();
	const cover = page.getByRole('dialog', { name: 'Screen covered' });
	await cover.getByRole('button', { name: 'Player view' }).tap();
	const view = page.getByRole('dialog', { name: 'Trouble Brewing' });
	await expect(view.getByRole('button', { name: 'Townsfolk', exact: true })).toBeVisible();
	expect(await clippedBands(page)).toEqual([]);
	await page.keyboard.press('Escape');
	await expect(view).toBeHidden();
	await page.keyboard.press('Escape');
	await expect(cover).toBeHidden();

	// A seat's character picker, a list that scrolls on its own.
	await page.getByRole('button', { name: /^Seat 1:/ }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Choose' }).first().tap();
	const picker = page.getByRole('dialog', { name: 'Character for Seat 1' });
	await expect(picker.getByRole('button', { name: 'Townsfolk', exact: true })).toBeVisible();
	expect(await clippedBands(page)).toEqual([]);
});

import { expect, test, type Locator } from '@playwright/test';
import { toBoard } from './new-game.ts';

// With a mouse and keyboard: hover and focus effects show once, and never hide a control.
test.use({ viewport: { width: 1280, height: 720 }, hasTouch: false, isMobile: false });

// Hovering tints a control over its own fill. Replacing the fill made the Demon bluffs
// drop-down's light text vanish on the cream sheet (Trevor, 2026-10-18). That drop-down is
// now a toggle, so the day timer sheet's sound drop-down stands in for it.
test('hovering a drop-down keeps its fill', async ({ page }) => {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.click();
	await page.getByRole('button', { name: 'Start game' }).click();
	await toBoard(page);
	await page.getByRole('button', { name: /^Day timer, .*open its controls$/ }).click();

	const trigger = page
		.getByRole('dialog', { name: 'Day timer' })
		.getByRole('combobox', { name: 'Timer sound' });
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

/**
 * The contrast between an element's text and what is actually behind it: its own fill (and
 * any hover tint layered on it) over every see-through fill out to the first solid one.
 */
async function textContrast(target: Locator): Promise<number> {
	return target.evaluate((el) => {
		type Rgba = [number, number, number, number];
		const parse = (value: string): Rgba | undefined => {
			const srgb = value.match(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)/);
			if (srgb) return [+srgb[1] * 255, +srgb[2] * 255, +srgb[3] * 255, srgb[4] ? +srgb[4] : 1];
			const rgb = value.match(/rgba?\(([\d.]+),? ([\d.]+),? ([\d.]+)(?:,? \/? ?([\d.]+))?\)/);
			if (rgb) return [+rgb[1], +rgb[2], +rgb[3], rgb[4] ? +rgb[4] : 1];
		};
		const over = (top: Rgba, under: Rgba): Rgba => {
			const a = top[3] + under[3] * (1 - top[3]);
			if (a === 0) return [0, 0, 0, 0];
			const mix = (i: number) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a;
			return [mix(0), mix(1), mix(2), a];
		};
		// Fills from the element outwards; a background-image tint sits over its own fill.
		const layers: Rgba[] = [];
		for (let node: Element | null = el; node; node = node.parentElement) {
			const style = getComputedStyle(node);
			const tint = style.backgroundImage.startsWith('linear-gradient')
				? parse(style.backgroundImage.slice('linear-gradient('.length))
				: undefined;
			if (tint) layers.push(tint);
			const fill = parse(style.backgroundColor);
			if (fill && fill[3] > 0) layers.push(fill);
			if (fill?.[3] === 1) break;
		}
		const behind = layers.reduceRight<Rgba>((under, top) => over(top, under), [255, 255, 255, 1]);
		const text = over(parse(getComputedStyle(el).color)!, behind);
		const luminance = ([r, g, b]: Rgba) => {
			const channel = (c: number) => {
				const s = c / 255;
				return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
			};
			return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
		};
		const [light, dark] = [luminance(text), luminance(behind)].sort((a, b) => b - a);
		return (light + 0.05) / (dark + 0.05);
	});
}

// A hovered button's label stays readable, on parchment sheets and on dark dialogs alike
// (Trevor, 2026-10-18: a hovered Cancel in Demon bluffs was hard to read).
test('hovered buttons keep their labels readable', async ({ page }) => {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.click();
	await page.getByRole('button', { name: 'Start game' }).click();
	await toBoard(page);
	await page.getByRole('button', { name: 'More', exact: true }).click();
	const menu = page.getByRole('dialog', { name: 'Grimoire' });
	const history = menu.getByRole('button', { name: 'History' });
	await history.hover();
	await page.waitForTimeout(300);
	expect(await textContrast(history)).toBeGreaterThanOrEqual(4.5);

	await menu.getByRole('button', { name: 'Demon bluffs' }).click();
	await page.getByRole('button', { name: 'Choose' }).first().click();
	const cancel = page.getByRole('button', { name: 'Cancel' });
	await cancel.hover();
	await page.waitForTimeout(300);
	expect(await textContrast(cancel)).toBeGreaterThanOrEqual(4.5);
});

// Every overlay reads on its own panel: the day timer's sheet was brown digits on a brown
// clock (Trevor, 2026-10-18), and sheets now share the dialogs' colours.
test('the day timer sheet and Info tokens read on their panel', async ({ page }) => {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.click();
	await page.getByRole('button', { name: 'Start game' }).click();
	await toBoard(page);
	await page.getByRole('button', { name: /^Day timer, .*open its controls$/ }).click();
	const sheet = page.getByTestId('timer-sheet');
	await expect(sheet).toBeVisible();
	await page.waitForTimeout(400);
	expect(await textContrast(sheet.getByRole('timer'))).toBeGreaterThanOrEqual(4.5);
	expect(
		await textContrast(page.getByRole('heading', { name: 'Day timer' }))
	).toBeGreaterThanOrEqual(4.5);
	await page.keyboard.press('Escape');

	await page.getByRole('button', { name: 'Info tokens', exact: true }).click();
	const tile = page.getByRole('button', { name: 'You are', exact: true });
	await expect(tile).toBeVisible();
	await page.waitForTimeout(400);
	expect(await textContrast(tile)).toBeGreaterThanOrEqual(4.5);
	// The same panel colour as a dialog's.
	const panel = (name: string) =>
		page.getByRole('dialog', { name }).evaluate((el) => getComputedStyle(el).backgroundColor);
	const sheetColour = await panel('Info tokens');
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'More', exact: true }).click();
	expect(await panel('Grimoire')).toBe(sheetColour);
});

// The timer's focus ring goes round the whole pill, not round the clock alone, and clicking
// in and out of its sheet leaves no ring (Trevor, 2026-10-18).
test('the board timer shows one ring round the whole pill', async ({ page }) => {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.click();
	await page.getByRole('button', { name: 'Start game' }).click();
	await toBoard(page);
	const timer = page.getByTestId('day-timer').first();
	const open = timer.getByRole('button', { name: /open its controls$/ });
	const ring = (el: typeof timer) => el.evaluate((node) => getComputedStyle(node).outlineStyle);

	await open.click();
	await expect(page.getByTestId('timer-sheet')).toBeVisible();
	await page.mouse.click(5, 5);
	await expect(page.getByTestId('timer-sheet')).toBeHidden();
	expect(await ring(open)).toBe('none');
	expect(await ring(timer)).toBe('none');

	await open.focus();
	await page.keyboard.press('Shift+Tab');
	await page.keyboard.press('Tab');
	await expect(open).toBeFocused();
	expect(await ring(open)).toBe('none');
	expect(await ring(timer)).toBe('solid');
});

// Every close X is round with the same hover tint (Trevor, 2026-10-18: "some places it is
// square, other places it is a circle").
test('close buttons are round and tint the same on hover', async ({ page }) => {
	async function roundTint(button: Locator) {
		await button.hover();
		const tint = () => button.evaluate((el) => getComputedStyle(el).backgroundImage);
		await expect.poll(tint).not.toBe('none');
		const style = await button.evaluate((el) => {
			const s = getComputedStyle(el);
			const box = el.getBoundingClientRect();
			return {
				round: parseFloat(s.borderTopLeftRadius) >= box.width / 2,
				square: Math.abs(box.width - box.height) < 1,
				tint: s.backgroundImage
			};
		});
		expect(style.round && style.square).toBe(true);
		return tint();
	}

	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.click();
	await page.getByRole('button', { name: 'Start game' }).click();
	await toBoard(page);
	await page.getByRole('button', { name: 'More', exact: true }).click();
	const sheet = page.getByRole('dialog', { name: 'Grimoire' });
	const sheetTint = await roundTint(sheet.getByRole('button', { name: 'Close' }));

	await sheet.getByRole('button', { name: 'Demon bluffs' }).click();
	await page.getByRole('button', { name: 'Choose' }).first().click();
	const dialog = page.getByRole('dialog').last();
	expect(await roundTint(dialog.getByRole('button', { name: 'Close' }).first())).toBe(sheetTint);
});

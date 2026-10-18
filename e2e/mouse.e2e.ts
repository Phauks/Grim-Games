import { expect, test, type Locator } from '@playwright/test';

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

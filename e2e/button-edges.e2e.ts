import { expect, test, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';

// Trevor (2026-10-22): a button whose fill is the colour of the surface around it has no
// edge, "a source of ui pain i have had to address". A static lint can't know what a button
// sits on, so this walks the main screens and checks every filled button against the colour
// actually behind it: the fill or the button's own edge must reach 3:1 (WCAG 1.4.11).

const ROUTES = [
	'/',
	'/new',
	'/games',
	'/reference',
	'/scripts',
	'/settings',
	'/library',
	'/info-tokens',
	'/build-script',
	'/build-character',
	'/join'
];

/**
 * Buttons that blend in today, by screen and name, each to fix in its own feature's PR. The
 * list only shrinks: a button that now passes must come off it, and a new one fails.
 */
const BUTTON_EDGE_TODO: readonly string[] = [
	// The Library's chosen folder (Library).
	'/library: entry'
];

/** Filled buttons on screen whose fill and edge both blend into what is behind them. */
async function blending(page: Page, screen: string): Promise<string[]> {
	const found = await page.evaluate(() => {
		type Rgba = [number, number, number, number];
		const parse = (css: string): Rgba | undefined => {
			const n = css.match(/[\d.]+/g)?.map(Number);
			if (!n || n.length < 3 || !/^rgba?\(/.test(css.trim())) return undefined;
			return [n[0], n[1], n[2], n[3] ?? 1];
		};
		const over = (top: Rgba, under: Rgba): Rgba => {
			const a = top[3];
			return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1) as Rgba;
		};
		const lum = ([r, g, b]: Rgba) => {
			const c = (v: number) => {
				const s = v / 255;
				return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
			};
			return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
		};
		const ratio = (a: Rgba, b: Rgba) => {
			const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
			return (hi + 0.05) / (lo + 0.05);
		};
		const root = getComputedStyle(document.documentElement);
		const page = parse(root.backgroundColor) ?? [0, 0, 0, 1];
		/** The opaque colour behind an element: its ancestors' fills, stacked. */
		const behind = (el: Element): Rgba => {
			const layers: Rgba[] = [];
			for (let p = el.parentElement; p; p = p.parentElement) {
				const style = getComputedStyle(p);
				const fill = parse(style.backgroundColor);
				if (fill && fill[3] > 0) layers.push(fill);
				if (fill && fill[3] >= 1) break;
			}
			return layers.reduceRight<Rgba>((under, top) => over(top, under), page);
		};
		const visible = (el: Element) => {
			const box = el.getBoundingClientRect();
			if (box.width < 1 || box.height < 1) return false;
			const style = getComputedStyle(el);
			return style.visibility !== 'hidden' && style.display !== 'none';
		};
		const name = (el: Element) =>
			(el.getAttribute('aria-label') ?? el.textContent ?? '')
				.trim()
				.replace(/\s+/g, ' ')
				.slice(0, 40);
		const out: string[] = [];
		for (const el of document.querySelectorAll('button, a.button, [role="button"]')) {
			// At rest only: a hover's wash is not the button's fill.
			if (!visible(el) || (el as HTMLButtonElement).disabled || el.matches(':hover')) continue;
			const style = getComputedStyle(el);
			const fill = parse(style.backgroundColor);
			if (!fill || fill[3] === 0) continue; // no fill to match
			const outside = behind(el);
			const face = over(fill, outside);
			const edges: Rgba[] = [];
			const ring = style.boxShadow.match(/rgba?\([^)]*\)[^,]*inset/g) ?? [];
			for (const r of ring) {
				const colour = parse(r.match(/rgba?\([^)]*\)/)![0]);
				if (colour && colour[3] > 0) edges.push(over(colour, outside));
			}
			for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
				if (!(parseFloat(style[`border${side}Width`]) > 0)) continue;
				const colour = parse(style[`border${side}Color`]);
				if (colour && colour[3] > 0) edges.push(over(colour, outside));
			}
			const best = Math.max(ratio(face, outside), ...edges.map((e) => ratio(e, outside)));
			// Keyed by the component's own class, so the list holds whatever the screen shows.
			const kind = [...el.classList].find((c) => !c.startsWith('svelte-')) ?? el.tagName;
			if (best < 3) out.push(`${kind}|${name(el)} (${best.toFixed(2)}:1)`);
		}
		return out;
	});
	return found.map((f) => `${screen}: ${f}`);
}

/** "screen: component", whatever button of that component the screen shows. */
const key = (found: string) => found.replace(/\|.*$/, '');
const check = blending;

test('no filled button blends into the surface behind it', async ({ page }) => {
	test.setTimeout(120_000);
	const seen: string[] = [];
	for (const route of ROUTES) {
		await page.goto(route);
		await page.locator('h1, h2').first().waitFor();
		seen.push(...(await check(page, route)));
	}

	// The board, its More menu and a seat's sheet.
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	seen.push(...(await check(page, 'board')));
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await expect(page.getByRole('dialog', { name: 'Grimoire' })).toBeVisible();
	seen.push(...(await check(page, 'board More menu')));
	await page.keyboard.press('Escape');
	await page.getByTestId('seat').first().tap();
	await expect(page.getByRole('dialog').last()).toBeVisible();
	seen.push(...(await check(page, 'seat sheet')));

	const fresh = [...new Set(seen)].filter((f) => !BUTTON_EDGE_TODO.includes(key(f)));
	expect(fresh, 'buttons that blend into their surface').toEqual([]);
	// Shrink only: a button that passes now comes off the list.
	const keys = seen.map(key);
	const stale = BUTTON_EDGE_TODO.filter((t) => !keys.includes(t));
	expect(stale, 'fixed: remove from BUTTON_EDGE_TODO').toEqual([]);
});

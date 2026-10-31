import { expect, test, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';

// Trevor (2026-10-27): "There should always be a delineator between anything that has a carrot
// menu, lint for this", and on the player's tabs, "All these seem to use different indents and
// stuff. Should use same". `grim/caret-section` makes every caret the shared Collapsible (each
// marks its caret `data-caret`); where a line sits is only known once the page is drawn, so
// this checks the drawn screens: between every caret's section and whatever is above it there
// is a line (a border, or the section or its neighbour being a box of its own).

const ROUTES = [
	'/',
	'/new',
	'/history',
	'/reference',
	'/scripts',
	'/library',
	'/info-tokens',
	'/build-script',
	'/build-character',
	'/join',
	'/about',
	'/changelog',
	'/roadmap'
];

/** Carets with nothing between them and what is above, by screen and caret label. */
async function unlined(page: Page, screen: string): Promise<string[]> {
	await page.waitForFunction(() =>
		document.getAnimations().every((a) => a.playState !== 'running')
	);
	const found = await page.evaluate(() => {
		const opaque = (css: string) => {
			const n = css.match(/[\d.]+/g)?.map(Number);
			return !!n && n.length >= 3 && (n[3] ?? 1) > 0;
		};
		const visible = (el: Element) => {
			const b = el.getBoundingClientRect();
			const s = getComputedStyle(el);
			return b.width > 1 && b.height > 1 && s.visibility !== 'hidden' && s.display !== 'none';
		};
		const line = (el: Element, side: 'Top' | 'Bottom') => {
			const s = getComputedStyle(el);
			return parseFloat(s[`border${side}Width`]) > 0 && opaque(s[`border${side}Color`]);
		};
		/** A box of its own: edged all round, or its own fill. */
		const boxed = (el: Element) => {
			const s = getComputedStyle(el);
			const edged = (['Top', 'Right', 'Bottom', 'Left'] as const).every(
				(side) => parseFloat(s[`border${side}Width`]) > 0 && opaque(s[`border${side}Color`])
			);
			const parent = el.parentElement && getComputedStyle(el.parentElement).backgroundColor;
			return edged || (opaque(s.backgroundColor) && s.backgroundColor !== parent);
		};
		const out: string[] = [];
		for (const caret of document.querySelectorAll('[data-caret]')) {
			if (!visible(caret)) continue;
			const toggle = caret.closest('button') ?? caret;
			const top = toggle.getBoundingClientRect().top;
			const chain: Element[] = [];
			let ok = true;
			for (let el: Element | null = toggle; el && el !== document.body; el = el.parentElement) {
				chain.push(el);
				const elTop = el.getBoundingClientRect().top;
				// The nearest sibling above it (one beside it is not above it).
				let prev = el.previousElementSibling;
				while (prev && (!visible(prev) || prev.getBoundingClientRect().bottom > elTop + 2))
					prev = prev.previousElementSibling;
				if (!prev) {
					if (boxed(el) || el.matches('[role="dialog"], [data-part="content"]')) break;
					continue;
				}
				const bottom = prev.getBoundingClientRect().bottom;
				const inBand = (y: number) => y >= bottom - 2 && y <= top + 2;
				// A line under its neighbour's last row, inside the neighbour's own padding.
				const nearBottom = (y: number) => y >= bottom - 24 && y <= top + 2;
				// A character type's band is its own mark, and ends the list above it (Trevor,
				// 2026-10-31: no extra line at a type list's start or end).
				const band = (e: Element) => !!e.querySelector(':scope > .head[data-type-band]');
				ok =
					band(el) ||
					band(prev) ||
					prev.tagName === 'HR' ||
					boxed(el) ||
					boxed(prev) ||
					chain.some((c) => line(c, 'Top') && inBand(c.getBoundingClientRect().top)) ||
					[prev, ...prev.querySelectorAll('*')].some(
						(d) => line(d, 'Bottom') && nearBottom(d.getBoundingClientRect().bottom)
					);
				break;
			}
			if (!ok) out.push((toggle.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40));
		}
		return out;
	});
	return found.map((f) => `${screen}: ${f}`);
}

/** The caret's distance from the left of the tab panel, for each caret on the open tab. */
async function caretInsets(page: Page): Promise<number[]> {
	return page
		.getByRole('tabpanel')
		.evaluate((panel) =>
			[...panel.querySelectorAll('[data-caret]')].map((c) =>
				Math.round(c.getBoundingClientRect().left - panel.getBoundingClientRect().left)
			)
		);
}

test('every caret has a line between it and what is above it', async ({ page }) => {
	test.setTimeout(240_000);
	const seen: string[] = [];
	for (const route of ROUTES) {
		await page.goto(route);
		await page.locator('h1, h2').first().waitFor();
		seen.push(...(await unlined(page, route)));
	}
	// Settings' closing groups (Theme's colours).
	await page.goto('/settings');
	await page.getByRole('dialog').last().waitFor();
	seen.push(...(await unlined(page, 'settings')));
	// The board: the day's sections and the board's Script sheet.
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	seen.push(...(await unlined(page, 'board')));

	expect([...new Set(seen)], 'carets with no line above them').toEqual([]);
});

test('the player’s tabs share one stack: same inset, a line between sections', async ({ page }) => {
	await page.goto('/play');
	await page.getByRole('button', { name: 'Trouble Brewing' }).tap({ timeout: 15_000 });
	await expect(page.getByRole('heading', { name: 'Trouble Brewing', level: 1 })).toBeVisible();
	const insets: number[] = [];
	const seen: string[] = [];
	for (const tab of ['Script', 'Night', 'Notes']) {
		const button = page.getByRole('tab', { name: tab, exact: true });
		if (!(await button.isVisible())) continue;
		await button.tap();
		await expect(page.getByRole('tabpanel').locator('[data-caret]').first()).toBeVisible();
		insets.push(...(await caretInsets(page)));
		seen.push(...(await unlined(page, tab)));
	}
	expect(new Set(insets).size, `caret insets ${insets.join(', ')}`).toBe(1);
	expect(seen, 'carets with no line above them').toEqual([]);
});

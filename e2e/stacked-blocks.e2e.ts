import { expect, test, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';

// Trevor (2026-10-22): pieces of information stacked one under another with nothing between
// them (special rule toggles over their descriptions) read as one block. Where things sit is
// only known once the page is drawn, so this is a check over the drawn screens, not a code
// lint: two blocks of the same kind, one under the other, each two lines or more, flag when
// neither draws an edge or its own fill, neither opens with a heading, and less than 1rem
// separates them.

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
 * Lists that run together today, by screen and "parent > block", each for its owner to fix.
 * Shrink only: one that now passes must come off, and a new one fails.
 */
const STACKED_TODO: readonly string[] = [];

/** "screen: parent > block", whatever text that list shows. */
const key = (found: string) => found.replace(/ \(gap.*$/, '');

async function undelineated(page: Page, screen: string): Promise<string[]> {
	// Measured once sheets have finished sliding in.
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
		/**
		 * Lines of text a block shows. Runs whose boxes overlap top to bottom share a line, so a
		 * count badge beside its label (smaller text, centred) is not a line of its own.
		 */
		const lines = (el: Element) => {
			const rows: { top: number; bottom: number }[] = [];
			const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
			for (let n = walker.nextNode(); n; n = walker.nextNode()) {
				if (!n.textContent?.trim()) continue;
				const range = document.createRange();
				range.selectNodeContents(n);
				for (const r of range.getClientRects()) {
					if (r.height <= 0) continue;
					const row = rows.find((w) => r.top < w.bottom - 1 && r.bottom > w.top + 1);
					if (row) {
						row.top = Math.min(row.top, r.top);
						row.bottom = Math.max(row.bottom, r.bottom);
					} else rows.push({ top: r.top, bottom: r.bottom });
				}
			}
			return rows.length;
		};
		const edgedSelf = (el: Element) => {
			const s = getComputedStyle(el);
			const side = (w: string, c: string) => parseFloat(w) > 0 && opaque(c);
			return (
				side(s.borderTopWidth, s.borderTopColor) ||
				side(s.borderBottomWidth, s.borderBottomColor) ||
				(s.boxShadow !== 'none' && /rgba?\(/.test(s.boxShadow)) ||
				(opaque(s.backgroundColor) &&
					s.backgroundColor !== getComputedStyle(el.parentElement!).backgroundColor)
			);
		};
		/** The block, or a part spanning most of it, draws an edge or its own fill. */
		const edged = (el: Element): boolean => {
			if (edgedSelf(el)) return true;
			const box = el.getBoundingClientRect();
			for (const d of el.querySelectorAll('*')) {
				const r = d.getBoundingClientRect();
				if (r.width >= box.width * 0.9 && r.height >= box.height * 0.5 && edgedSelf(d)) return true;
			}
			return false;
		};
		const kind = (el: Element) =>
			`${el.tagName.toLowerCase()}.${[...el.classList].find((c) => !c.startsWith('svelte-')) ?? ''}`;
		const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
		const out: string[] = [];
		for (const parent of document.querySelectorAll('body *')) {
			const kids = [...parent.children].filter(visible);
			for (let i = 1; i < kids.length; i++) {
				const [a, b] = [kids[i - 1], kids[i]];
				if (kind(a) !== kind(b) || ['HR', 'TD', 'TH'].includes(a.tagName)) continue;
				const [ra, rb] = [a.getBoundingClientRect(), b.getBoundingClientRect()];
				if (rb.top < ra.bottom - 1 || Math.abs(ra.left - rb.left) > 2) continue; // not stacked
				if (lines(a) < 2 || lines(b) < 2) continue; // single lines read as a list
				if (edged(a) || edged(b)) continue;
				// A block that opens with its own heading is delineated by it (sections).
				const headed = (el: Element) =>
					!!el.querySelector(
						':scope > :is(h1,h2,h3,h4,h5,h6,legend,header), :scope > * > :is(h1,h2,h3,h4,h5,h6)'
					);
				if (headed(a) && headed(b)) continue;
				const gap = rb.top - ra.bottom;
				if (gap >= rem) continue; // a clear gap delineates
				out.push(
					`${kind(parent)} > ${kind(a)} (gap ${gap.toFixed(0)}px): ${(a.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 50)}`
				);
				break;
			}
		}
		return out;
	});
	return found.map((f) => `${screen}: ${f}`);
}

test('no list of information runs together without a divider, a gap or a heading', async ({
	page
}) => {
	test.setTimeout(180_000);
	const seen: string[] = [];
	for (const route of ROUTES) {
		await page.goto(route);
		await page.locator('h1, h2').first().waitFor();
		// Reference fills its table after the page draws.
		if (route === '/reference')
			await page.getByTestId('character-table').locator('[data-character]').first().waitFor();
		seen.push(...(await undelineated(page, route)));
	}
	await page.goto('/new');
	await page.getByRole('button', { name: /^Special rules/ }).tap();
	await page.getByRole('dialog').last().waitFor();
	seen.push(...(await undelineated(page, 'special rules')));
	// The board's ⋯ menu and a seat's sheet.
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await toBoard(page);
	await page.getByRole('button', { name: 'More', exact: true }).tap();
	await expect(page.getByRole('dialog', { name: 'Grimoire' })).toBeVisible();
	seen.push(...(await undelineated(page, 'board More menu')));
	await page.keyboard.press('Escape');
	await page.getByTestId('seat').first().tap();
	await expect(page.getByRole('dialog').last()).toBeVisible();
	seen.push(...(await undelineated(page, 'seat sheet')));

	const fresh = [...new Set(seen)].filter((f) => !STACKED_TODO.includes(key(f)));
	expect(fresh, 'information that runs together').toEqual([]);
	const keys = seen.map(key);
	const stale = STACKED_TODO.filter((t) => !keys.includes(t));
	expect(stale, 'fixed: remove from STACKED_TODO').toEqual([]);
});

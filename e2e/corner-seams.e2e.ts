import { expect, test, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';

/*
 * Trevor (2026-11-05, the jinx pair): "i can see line delineating the two different parts". When
 * a filled shape's rounded corner is drawn exactly on its parent's rounded corner (a badge's
 * icon disc in the pill's round end), both curves are anti-aliased and the parent's fill shows
 * through between them as a thin line. A static lint can't see where two curves land, so this
 * walks the main screens, finds every rounded corner that sits on its parent's, and paints the
 * parent in the child's colour: if the corner's pixels change, the parent's fill was showing.
 * The fix is to fill the parent under that corner with the child's colour (CharacterBadge).
 */

const ROUTES = [
	'/',
	'/new',
	'/reference',
	'/scripts',
	'/settings',
	'/library',
	'/info-tokens',
	'/build-script',
	'/build-character',
	'/spikes/badges'
];

/** Seams seen today, by screen and component pair, each to fix in its own PR. Shrink only. */
const CORNER_SEAM_TODO: readonly string[] = [];

/** How many of one component pair to check on a screen: they are drawn alike. */
const PER_KIND = 20;

interface Corner {
	key: string;
	parent: number;
	child: number;
	corner: readonly [right: number, bottom: number];
	r: number;
	fill: string;
}

/** Rounded corners that sit on their parent's rounded corner, over a fill of another colour. */
function coincidentCorners(page: Page): Promise<Corner[]> {
	return page.evaluate((perKind) => {
		const opaque = (css: string) => /^rgb\(/.test(css) || /^rgba\(.*,\s*1\)$/.test(css);
		const painted = (css: string) => css !== 'transparent' && !/,\s*0\)$/.test(css);
		const kind = (el: Element) =>
			[...el.classList].find((c) => !c.startsWith('svelte-')) ?? el.tagName.toLowerCase();
		const CORNERS = [
			['TopLeft', 0, 0],
			['TopRight', 1, 0],
			['BottomLeft', 0, 1],
			['BottomRight', 1, 1]
		] as const;
		/** The corner's radius as drawn: a big radius is cut to half the shorter side. */
		const radius = (style: CSSStyleDeclaration, corner: string, box: DOMRect) => {
			const raw = style.getPropertyValue(
				`border-${corner
					.replace(/([A-Z])/g, '-$1')
					.toLowerCase()
					.slice(1)}-radius`
			);
			const first = raw.split(' ')[0] ?? '0';
			const r = first.endsWith('%') ? (parseFloat(first) / 100) * box.width : parseFloat(first);
			return Math.min(r || 0, box.width / 2, box.height / 2);
		};
		const out: Corner[] = [];
		const seen = new Map<string, number>();
		let next = 0;
		const mark = (el: Element) => {
			if (!el.hasAttribute('data-seam-check')) el.setAttribute('data-seam-check', `${next++}`);
			return Number(el.getAttribute('data-seam-check'));
		};
		for (const child of document.querySelectorAll('body *')) {
			const style = getComputedStyle(child);
			if (!opaque(style.backgroundColor) || style.visibility === 'hidden') continue;
			const box = child.getBoundingClientRect();
			if (box.width < 4 || box.height < 4) continue;
			for (const [corner, right, bottom] of CORNERS) {
				const r = radius(style, corner, box);
				if (r < 3) continue;
				// The nearest painted ancestor whose same corner is at the same spot and as round.
				for (let p = child.parentElement, depth = 0; p && depth < 4; p = p.parentElement, depth++) {
					const ps = getComputedStyle(p);
					if (!painted(ps.backgroundColor)) continue;
					const pb = p.getBoundingClientRect();
					const x = right ? box.right : box.left;
					const y = bottom ? box.bottom : box.top;
					const px = right ? pb.right : pb.left;
					const py = bottom ? pb.bottom : pb.top;
					if (Math.abs(x - px) > 0.75 || Math.abs(y - py) > 0.75) break;
					if (Math.abs(radius(ps, corner, pb) - r) > 1) break;
					if (ps.backgroundColor === style.backgroundColor) break;
					const key = `${kind(p)} > ${kind(child)}`;
					const count = seen.get(key) ?? 0;
					if (count >= perKind) break;
					seen.set(key, count + 1);
					out.push({
						key,
						parent: mark(p),
						child: mark(child),
						corner: [right, bottom],
						r,
						fill: style.backgroundColor
					});
					break;
				}
			}
		}
		return out;
	}, PER_KIND);
}

/**
 * How two pictures of the same spot differ: the largest change in any colour channel (0 to
 * 255), and how many pixels changed by at least STEP.
 */
function difference(page: Page, a: Buffer, b: Buffer): Promise<[number, number]> {
	return page.evaluate(
		async ([a, b, step]) => {
			const pixels = async (base64: string) => {
				// Not a data: URL, which the app's CSP refuses to fetch.
				const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
				const blob = new Blob([bytes], { type: 'image/png' });
				const bitmap = await createImageBitmap(blob);
				const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
				const ctx = canvas.getContext('2d')!;
				ctx.drawImage(bitmap, 0, 0);
				return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
			};
			const [x, y] = [await pixels(a), await pixels(b)];
			let most = 0;
			let count = 0;
			for (let i = 0; i < Math.min(x.length, y.length); i += 4) {
				const d = Math.max(...[0, 1, 2].map((c) => Math.abs(x[i + c] - y[i + c])));
				most = Math.max(most, d);
				if (d >= step) count++;
			}
			return [most, count];
		},
		[a.toString('base64'), b.toString('base64'), STEP] as const
	);
}

/**
 * A pixel that changes by STEP or more shows the parent; a seam is SEAM such pixels or more.
 * Measured on the badge's icon disc (2026-11-05): a seam changed 10 to 18 pixels by 12 to 33,
 * the fixed badge none (its largest change was 9, rounding in the anti-aliasing).
 */
const STEP = 12;
const SEAM = 2;

async function seams(page: Page, screen: string): Promise<string[]> {
	await page.evaluate(() => document.fonts.ready);
	const found: string[] = [];
	for (const corner of await coincidentCorners(page)) {
		const parent = page.locator(`[data-seam-check="${corner.parent}"]`);
		const child = page.locator(`[data-seam-check="${corner.child}"]`);
		await child.scrollIntoViewIfNeeded();
		const box = await child.boundingBox();
		if (!box) continue;
		const [right, bottom] = corner.corner;
		const { r } = corner;
		// The corner's square, less a pixel on its inner sides: those meet the rest of the
		// parent, whose own fill may rightly start there.
		const side = r - 1;
		const clip = {
			x: right ? box.x + box.width - side : box.x,
			y: bottom ? box.y + box.height - side : box.y,
			width: side,
			height: side
		};
		const before = await page.screenshot({ clip, animations: 'disabled' });
		await parent.evaluate((el, fill) => {
			(el as HTMLElement).style.setProperty('transition', 'none', 'important');
			(el as HTMLElement).style.setProperty('background-color', fill, 'important');
		}, corner.fill);
		const after = await page.screenshot({ clip, animations: 'disabled' });
		await parent.evaluate((el) => {
			(el as HTMLElement).style.removeProperty('background-color');
			(el as HTMLElement).style.removeProperty('transition');
		});
		const [, count] = await difference(page, before, after);
		if (count >= SEAM) found.push(`${screen}: ${corner.key}`);
	}
	return [...new Set(found)];
}

test('no rounded corner shows its parent as a line round its edge', async ({ page }) => {
	test.setTimeout(180_000);
	const seen: string[] = [];
	for (const route of ROUTES) {
		await page.goto(route);
		await page.locator('h1, h2').first().waitFor();
		seen.push(...(await seams(page, route)));
	}

	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	seen.push(...(await seams(page, 'board')));

	const fresh = seen.filter((f) => !CORNER_SEAM_TODO.includes(f));
	expect(fresh, 'rounded corners with a line round them').toEqual([]);
	const stale = CORNER_SEAM_TODO.filter((t) => !seen.includes(t));
	expect(stale, 'fixed: remove from CORNER_SEAM_TODO').toEqual([]);
});

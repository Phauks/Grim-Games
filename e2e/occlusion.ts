import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Nothing covers anything (Trevor, 2026-11-06: "their biggest UI issues always with stuff
 * being covered up"). For every heading, button, link, tab and status line in view, asks the
 * browser what is drawn on top at its middle and at the middle of each edge, just inside it. If
 * something else is drawn there, a sheet pulled up over it, a pinned bar or a header band, the
 * element is covered and the check fails, naming both.
 *
 * Only what can be seen is checked: anything outside its scrolling boxes, under a bottom bar
 * (content scrolls under those), hidden or tiny is left out. Run it at rest, scrolled to the
 * top; pinned headings over scrolled content are by design. `known` lists the cases found but
 * not fixed yet, exactly as reported, so the list can only shrink.
 */
export async function expectNothingCovered(page: Page, within?: Locator, known: string[] = []) {
	const scope = within ?? page.locator('body');
	await page.evaluate(() => document.fonts.ready);
	// Let entrances (dialog fades, sheet slides) and measured layout (fillToBottom) settle.
	await expect(async () => {
		const covered = await scope.evaluate(findCovered);
		// Known cases only ever shrink: once one is fixed, it comes off the list.
		expect(covered, 'elements drawn under something else').toEqual(known);
	}).toPass({ timeout: 5_000 });
}

/** Runs in the page: what is covered under `root`, as "what (covered by what)" lines. */
function findCovered(root: Element): string[] {
	const SELECTOR = [
		'h1',
		'h2',
		'h3',
		'h4',
		'button',
		'a[href]',
		'[role="tab"]',
		'[role="status"]',
		'[role="button"]',
		'input:not([type="hidden"])',
		'select',
		'textarea'
	].join(',');
	const describe = (el: Element) => {
		const name =
			el.getAttribute('aria-label') ||
			el.getAttribute('data-testid') ||
			(el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
		const cls = typeof el.className === 'string' ? el.className.split(/\s+/)[0] : '';
		return `<${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}> "${name}"`;
	};
	/** The part of the screen `el` can be seen in: the viewport cut by every box that clips it. */
	const visibleArea = (el: Element) => {
		let top = 0;
		let left = 0;
		let bottom = window.innerHeight;
		let right = window.innerWidth;
		for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
			const style = getComputedStyle(node);
			if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
			const box = node.getBoundingClientRect();
			top = Math.max(top, box.top);
			left = Math.max(left, box.left);
			bottom = Math.min(bottom, box.bottom);
			right = Math.min(right, box.right);
		}
		// Content scrolls under a bottom bar by design: only what is above its top counts.
		for (const bar of document.querySelectorAll('[data-bottom-bar]')) {
			if (bar.contains(el)) continue;
			const box = bar.getBoundingClientRect();
			if (box.height > 0 && box.top < bottom && box.top > top) bottom = box.top;
		}
		return { top, left, bottom, right };
	};
	/** The nearest box around `el`, within a few levels, with a colour of its own. */
	const paintedBox = (el: Element) => {
		let node: Element | null = el;
		for (let level = 0; node && level < 3; level++, node = node.parentElement) {
			const style = getComputedStyle(node);
			if (style.backgroundColor === 'rgba(0, 0, 0, 0)') continue;
			const r = node.getBoundingClientRect();
			if (r.width <= window.innerWidth && r.height < window.innerHeight * 0.4) return node;
			return undefined;
		}
		return undefined;
	};
	const covered: string[] = [];
	for (const el of root.querySelectorAll(SELECTOR)) {
		if (!(el instanceof HTMLElement)) continue;
		if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
		if (el.closest('[aria-hidden="true"], [inert]')) continue;
		const box = el.getBoundingClientRect();
		// Visually hidden labels and hairlines are not things people see.
		if (box.width < 8 || box.height < 8) continue;
		const area = visibleArea(el);
		const whole =
			box.top >= area.top - 1 &&
			box.left >= area.left - 1 &&
			box.bottom <= area.bottom + 1 &&
			box.right <= area.right + 1;
		if (!whole) continue;
		// Just inside each edge's middle: rounded corners never reach there. Words that wrap
		// onto a second line are a box per line.
		const inset = 2;
		const points: [number, number][] = [...el.getClientRects()].flatMap((r) => {
			const x = r.left + r.width / 2;
			const y = r.top + r.height / 2;
			return [
				[x, y],
				[x, r.top + inset],
				[x, r.bottom - inset],
				[r.left + inset, y],
				[r.right - inset, y]
			] as [number, number][];
		});
		// The coloured box the words sit in, a band, pill or row: its top and bottom edges are
		// checked too, as words can be clear while the box's edge is covered (the paper sheet
		// over the bottom of the Game over row, 2026-11-06).
		const card = paintedBox(el);
		if (card) {
			const r = card.getBoundingClientRect();
			const x = r.left + r.width / 2;
			if (r.top >= area.top && r.bottom <= area.bottom)
				points.push([x, r.top + inset], [x, r.bottom - inset]);
		}
		const own = card ?? el;
		for (const [px, py] of points) {
			const hit = document.elementFromPoint(px, py);
			if (!hit || hit === el || el.contains(hit) || own.contains(hit)) continue;
			if (hit instanceof HTMLLabelElement && hit.control === el) continue;
			// Hit only through a pseudo-element reaching past the element's own box, such as a
			// rules term's larger tap target: a wider hit area, not something drawn on top.
			const inOwnBox = [...hit.getClientRects()].some(
				(r) => px >= r.left && px <= r.right && py >= r.top && py <= r.bottom
			);
			if (!inOwnBox) continue;
			// A field's own Clear or reveal button sits inside the field's box by design.
			if (el.matches('input, textarea, select') && el.parentElement?.contains(hit)) continue;
			// Clicks pass through it to its parent by design; that says nothing of drawing.
			if (hit.contains(el) && getComputedStyle(el).pointerEvents === 'none') continue;
			covered.push(`${describe(el)} covered by ${describe(hit)}`);
			break;
		}
	}
	return covered;
}

/**
 * A Svelte attachment for a row pinned with `position: sticky`: `{@attach pinnedRow}`. It
 * tells everything after it in its box where to pin, so nothing has to guess the row's height
 * (Trevor, 2026-11-06: "stuff being covered up"): each later sibling that sits under the row
 * gets `--pin-top` set to the row's own sticky top plus its height. Collapsible's pinned
 * heading reads `--pin-top`, so the sections that follow pin just under the row, and a row
 * pinned further down can use `top: var(--pin-top)` to stack under this one.
 *
 * A sibling beside the row rather than under it (a two-column layout) keeps whatever
 * `--pin-top` it inherits. The height is measured exactly, fractions included: a rounded one
 * leaves a sliver of scrolled content between the row and the heading under it.
 */
export function pinnedRow(row: HTMLElement) {
	const box = row.parentElement;
	if (!box) return;
	const later = () => {
		const after: HTMLElement[] = [];
		for (let next = row.nextElementSibling; next; next = next.nextElementSibling) {
			if (next instanceof HTMLElement) after.push(next);
		}
		return after;
	};
	const fit = () => {
		const own = row.getBoundingClientRect();
		const top = parseFloat(getComputedStyle(row).top) || 0;
		const below = `${top + own.height}px`;
		for (const next of later()) {
			const at = next.getBoundingClientRect();
			const under = at.left < own.right && at.right > own.left;
			if (under) next.style.setProperty('--pin-top', below);
			else next.style.removeProperty('--pin-top');
		}
	};
	fit();
	const sizes = new ResizeObserver(fit);
	sizes.observe(row);
	sizes.observe(box);
	// Sections that arrive later (a script loading) pin under the row too.
	const children = new MutationObserver(fit);
	children.observe(box, { childList: true });
	return () => {
		sizes.disconnect();
		children.disconnect();
		for (const next of later()) next.style.removeProperty('--pin-top');
	};
}

/**
 * A Svelte attachment: `{@attach fitInDialog}`. Inside a dialog's own scrolling box, sets
 * `--fit-height` on the element to the room left below its top in that box, so a board drawn
 * there (the Storyteller's player view, BoardPlayerView) fits the window instead of running
 * past its bottom on a wide, short desktop window (Trevor, 2026-10-27). In a tall box (a
 * phone or an upright tablet) the board stays tall and scrolls, as on /play, so the seats
 * and the corner's lines keep their room; on a page, which scrolls itself, it sets nothing.
 */
export function fitInDialog(element: HTMLElement) {
	const scroller = scrollerOf(element);
	if (!scroller?.closest('[role="dialog"]')) return;
	const box = scroller;
	const fit = () => {
		if (box.clientWidth < box.clientHeight) {
			element.style.removeProperty('--fit-height');
			return;
		}
		const top =
			element.getBoundingClientRect().top -
			box.getBoundingClientRect().top +
			box.scrollTop -
			box.clientTop;
		const bottom = parseFloat(getComputedStyle(box).paddingBottom) || 0;
		const room = Math.floor(box.clientHeight - top - bottom);
		element.style.setProperty('--fit-height', `${Math.max(0, room)}px`);
	};
	fit();
	// The box, and everything above the element in it (the status row, the tabs), can resize.
	const observer = new ResizeObserver(fit);
	observer.observe(box);
	for (const child of box.children) observer.observe(child);
	return () => {
		observer.disconnect();
		element.style.removeProperty('--fit-height');
	};
}

/** The nearest box above `element` that scrolls up and down. */
function scrollerOf(element: HTMLElement): HTMLElement | undefined {
	for (let node = element.parentElement; node; node = node.parentElement) {
		const { overflowY } = getComputedStyle(node);
		if (overflowY === 'auto' || overflowY === 'scroll') return node;
	}
	return undefined;
}

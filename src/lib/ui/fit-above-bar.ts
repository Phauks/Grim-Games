/**
 * A Svelte attachment: `{@attach fitAboveBar}`. Sets `--fit-height` on the element to the room
 * left below its top and above the bottom tab bar, in the window or in a dialog's own scrolling
 * box, so a board drawn there (the Grim tab on /play, the Storyteller's player view) shows whole,
 * its reminder tray included, without scrolling (Trevor, 2026-11-16: B, "board fits above the
 * tab bar"; the tray had sat behind the tab bar). Measured from the top of the scrolled
 * content, so scrolling never changes it. The element's own CSS decides what to do with the
 * room (PlayerGrim keeps a floor so the seats never crowd together).
 */
export function fitAboveBar(element: HTMLElement) {
	const scroller = scrollerOf(element);
	const box = scroller?.closest('[role="dialog"]') ? scroller : undefined;
	const fit = () => {
		// Full screen draws the board over everything, at the screen's own size.
		if (element.closest('[data-filled]')) {
			element.style.removeProperty('--fit-height');
			return;
		}
		const rect = element.getBoundingClientRect();
		const top = box
			? rect.top - box.getBoundingClientRect().top + box.scrollTop - box.clientTop
			: rect.top + window.scrollY;
		const height = box ? box.clientHeight : window.innerHeight;
		const padding = box ? parseFloat(getComputedStyle(box).paddingBottom) || 0 : 0;
		// Bottom-bar tabs (Tabs placement="bottom") cover the foot of the box or the window.
		const bar =
			(box ?? document).querySelector<HTMLElement>('[data-bottom-bar]')?.offsetHeight ?? 0;
		// A little space between the board and the bar, as between the page's parts.
		const gap = parseFloat(getComputedStyle(element).fontSize) / 2 || 0;
		const room = Math.floor(height - top - padding - bar - gap);
		element.style.setProperty('--fit-height', `${Math.max(0, room)}px`);
	};
	let frame = 0;
	const later = () => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(fit);
	};
	fit();
	// The window or box, and everything above the element (the header, the room row, the tabs),
	// can resize; the board's own size never changes its top, so this settles.
	const observer = new ResizeObserver(later);
	observer.observe(box ?? document.documentElement);
	if (box) for (const child of box.children) observer.observe(child);
	window.addEventListener('resize', later);
	return () => {
		cancelAnimationFrame(frame);
		observer.disconnect();
		window.removeEventListener('resize', later);
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

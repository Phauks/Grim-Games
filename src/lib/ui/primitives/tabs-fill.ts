/**
 * For bottom-bar tabs (`root`, Tabs placement="bottom"): stretches them to the bottom edge of
 * whatever scrolls them, the page or a dialog's scrolling box, so their bar starts at the
 * bottom even under a short panel and stays there by itself (position: sticky). The tabs also
 * reach over the bottom padding of the boxes they sit in, so the bar meets the edge at the end
 * of a long panel too, and never jumps between a short tab and a long one.
 */
export function fillToBottom(root: HTMLElement) {
	const box = scrollerOf(root);
	const fit = () => {
		root.style.removeProperty('min-height');
		const { padding, following } = under(root, box);
		root.style.marginBottom = `${-padding}px`;
		const view = box ? box.getBoundingClientRect() : { top: 0 };
		const height = box ? box.clientHeight : window.innerHeight;
		const scrolled = box ? box.scrollTop : window.scrollY;
		const rect = root.getBoundingClientRect();
		const top = rect.top - view.top + scrolled;
		const room = Math.floor(height - top - following);
		if (room > rect.height) root.style.minHeight = `${room}px`;
	};
	fit();
	const observer = new ResizeObserver(fit);
	observer.observe(box ?? document.documentElement);
	if (root.parentElement) observer.observe(root.parentElement);
	window.addEventListener('resize', fit);
	return () => {
		observer.disconnect();
		window.removeEventListener('resize', fit);
		root.style.removeProperty('min-height');
		root.style.removeProperty('margin-bottom');
	};
}

/**
 * What comes under `root` inside `box` (or the page): the bottom padding of the boxes it sits
 * in, and the height of the elements after it.
 */
function under(root: HTMLElement, box: HTMLElement | undefined) {
	let padding = 0;
	let following = 0;
	for (let node: HTMLElement = root; node.parentElement; node = node.parentElement) {
		for (let next = node.nextElementSibling; next; next = next.nextElementSibling) {
			const style = getComputedStyle(next);
			if (style.position === 'fixed' || style.position === 'absolute') continue;
			following += next.getBoundingClientRect().height + (parseFloat(style.marginTop) || 0);
		}
		const parent = node.parentElement;
		const style = getComputedStyle(parent);
		padding += (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.borderBottomWidth) || 0);
		if (parent === box || parent === document.body) break;
	}
	return { padding, following };
}

/** The nearest box above `element` that scrolls up and down; none means the page. */
function scrollerOf(element: HTMLElement): HTMLElement | undefined {
	for (let node = element.parentElement; node; node = node.parentElement) {
		if (node === document.body || node === document.documentElement) return undefined;
		const { overflowY } = getComputedStyle(node);
		if (overflowY === 'auto' || overflowY === 'scroll') return node;
	}
	return undefined;
}

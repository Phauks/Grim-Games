/**
 * Calls `onNear` once when an element comes within `margin` of the viewport (about two
 * screens by default), or of `root` when it scrolls inside its own box. The Reference cards
 * and `DataTable` rows are built this way, so a page of 181 characters starts with a few
 * thousand DOM nodes instead of about 20,000. One shared observer serves every element with
 * the same margin and box.
 */
const callbacks = new WeakMap<Element, () => void>();
const observers = new Map<Element | null, Map<string, IntersectionObserver>>();

function shared(margin: string, root: Element | null): IntersectionObserver {
	let byMargin = observers.get(root);
	if (!byMargin) observers.set(root, (byMargin = new Map()));
	let observer = byMargin.get(margin);
	if (!observer) {
		const created = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					callbacks.get(entry.target)?.();
					callbacks.delete(entry.target);
					created.unobserve(entry.target);
				}
			},
			{ root, rootMargin: margin }
		);
		byMargin.set(margin, created);
		observer = created;
	}
	return observer;
}

/**
 * A Svelte attachment: `{@attach near(() => (shown = true))}`. `margin` is how far past the
 * screen, above and below, counts as near (an IntersectionObserver rootMargin). `root`: the
 * box the element scrolls in, when that is not the page (a table that scrolls in its own box).
 */
export function near(onNear: () => void, margin = '200% 0px', root: Element | null = null) {
	return (element: Element) => {
		if (typeof IntersectionObserver === 'undefined') {
			onNear();
			return;
		}
		const observer = shared(margin, root);
		callbacks.set(element, onNear);
		observer.observe(element);
		return () => {
			callbacks.delete(element);
			observer.unobserve(element);
		};
	};
}

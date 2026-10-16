/**
 * Calls `onNear` once when an element comes within `margin` of the viewport (about two
 * screens by default). The Reference cards and `DataTable` rows are built this way, so a page
 * of 181 characters starts with a few thousand DOM nodes instead of about 20,000. One shared
 * observer serves every element with the same margin.
 */
const callbacks = new WeakMap<Element, () => void>();
const observers = new Map<string, IntersectionObserver>();

function shared(margin: string): IntersectionObserver {
	let observer = observers.get(margin);
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
			{ rootMargin: margin }
		);
		observers.set(margin, created);
		observer = created;
	}
	return observer;
}

/**
 * A Svelte attachment: `{@attach near(() => (shown = true))}`. `margin` is how far past the
 * screen, above and below, counts as near (an IntersectionObserver rootMargin).
 */
export function near(onNear: () => void, margin = '200% 0px') {
	return (element: Element) => {
		if (typeof IntersectionObserver === 'undefined') {
			onNear();
			return;
		}
		const observer = shared(margin);
		callbacks.set(element, onNear);
		observer.observe(element);
		return () => {
			callbacks.delete(element);
			observer.unobserve(element);
		};
	};
}

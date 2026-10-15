/**
 * Calls `onNear` once when an element comes within about two screens of the viewport. The
 * Reference page builds each card body and table row this way, so a page of 181
 * characters starts with a few thousand DOM nodes instead of about 20,000. One shared
 * observer serves every element.
 */
const callbacks = new WeakMap<Element, () => void>();
let observer: IntersectionObserver | undefined;

function shared(): IntersectionObserver {
	observer ??= new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				callbacks.get(entry.target)?.();
				callbacks.delete(entry.target);
				observer?.unobserve(entry.target);
			}
		},
		{ rootMargin: '200% 0px' }
	);
	return observer;
}

/** A Svelte attachment: `{@attach near(() => (shown = true))}`. */
export function near(onNear: () => void) {
	return (element: Element) => {
		if (typeof IntersectionObserver === 'undefined') {
			onNear();
			return;
		}
		callbacks.set(element, onNear);
		shared().observe(element);
		return () => {
			callbacks.delete(element);
			observer?.unobserve(element);
		};
	};
}

/**
 * Android Chrome buzzes about half a second into any long press, after the token is
 * already showing, so the buzz matched nothing (Trevor, 2026-10-25: "remove or correct
 * timing"). Cancelling the touch's default stops the long-press gesture and its buzz; the
 * hold itself runs on Pointer Events, which still fire. Svelte's own touch handlers are
 * passive, so this one is added by hand.
 */
export function noLongPress(node: HTMLElement) {
	const stop = (event: Event) => event.cancelable && event.preventDefault();
	node.addEventListener('touchstart', stop, { passive: false });
	// The image's own long-press menu too.
	node.addEventListener('contextmenu', stop);
	return () => {
		node.removeEventListener('touchstart', stop);
		node.removeEventListener('contextmenu', stop);
	};
}

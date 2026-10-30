/**
 * How much of the screen the on-screen keyboard covers, as `--keyboard-inset` on the root
 * element (0 when it is closed). Android Chrome and iOS Safari only shrink the visual
 * viewport when the keyboard opens, so fixed overlays such as dialogs stay behind it;
 * dialogs lift themselves by this much so their fields and Confirm stay in view (Trevor,
 * 2026-10-25). The browser may also scroll the visual viewport down to show the field being
 * typed in, which slid a dialog's header up off the screen (Trevor, 2026-10-30), so how far it
 * scrolled is `--keyboard-top` and dialogs start there. Returns the cleanup.
 */
export function trackKeyboardInset(): () => void {
	const viewport = window.visualViewport;
	if (!viewport) return () => {};
	const root = document.documentElement;
	const update = () => {
		const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
		root.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`); // px-ok: measured
		const top = Math.max(0, viewport.offsetTop);
		root.style.setProperty('--keyboard-top', `${Math.round(top)}px`); // px-ok: measured
	};
	update();
	viewport.addEventListener('resize', update);
	viewport.addEventListener('scroll', update);
	return () => {
		viewport.removeEventListener('resize', update);
		viewport.removeEventListener('scroll', update);
		root.style.removeProperty('--keyboard-inset');
		root.style.removeProperty('--keyboard-top');
	};
}

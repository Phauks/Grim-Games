import { getContext, setContext } from 'svelte';

/**
 * Where overlays opened inside a full-screen view go (the grim cover's PIN, Trevor
 * 2026-10-26). That view is a modal `<dialog>` in the browser's top layer, so a dialog, sheet
 * or popover portalled to the page's body would sit behind it, unseen and untappable. Inside
 * such a view, they portal into it instead; everywhere else, into the body as before.
 */
const KEY = Symbol('portal-target');

/** Called by the full-screen view, with its element once it has one. */
export function setPortalTarget(target: () => HTMLElement | undefined): void {
	setContext(KEY, target);
}

/** Called by an overlay while it is set up: its container, read when it opens. */
export function usePortalTarget(): () => HTMLElement | undefined {
	return getContext<(() => HTMLElement | undefined) | undefined>(KEY) ?? (() => undefined);
}

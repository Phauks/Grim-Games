/**
 * The order overlays (dialogs and sheets) were opened in, so the newest is always drawn on top
 * (Trevor, 2026-10-16: the Glossary opened from character details showed underneath it).
 * Ark portals overlays in the order their components mounted, not the order they opened, and
 * they all share one z-index, so without this an overlay mounted earlier (the Glossary dialog
 * lives in the root layout) sits below one mounted later. Focus, Escape and outside taps
 * already go to the newest layer through Ark's own layer stack.
 */
const open = new Map<symbol, number>();

/**
 * Takes the next layer for an overlay that just opened: one above every open overlay.
 * Returns the layer and a function to call when the overlay closes.
 */
export function openLayer(): { layer: number; close: () => void } {
	const id = Symbol('layer');
	const layer = Math.max(0, ...open.values()) + 1;
	open.set(id, layer);
	return { layer, close: () => open.delete(id) };
}

/** CSS for an overlay's parts at `layer`: the backdrop under the content, both above lower layers. */
export function layerStyle(layer: number, part: 'backdrop' | 'content'): string {
	return `--layer: ${layer * 2 + (part === 'content' ? 1 : 0)}`;
}

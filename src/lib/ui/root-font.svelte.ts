/**
 * The root font size in px, which Settings > Text changes: layout that measures in px (the
 * board's name boxes, a table's columns) reads it here rather than each asking the page.
 */
import { preferences } from '#lib/ui/preferences.svelte.ts';

/** The root font size now; 16 when the page can't say. */
export function rootFontPx(): number {
	return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

/** The root font size, kept current as the text settings change. Call while a component sets up. */
export function watchRootFont(): { readonly current: number } {
	let current = $state(16);
	$effect(() => {
		void preferences.current;
		current = rootFontPx();
	});
	return {
		get current() {
			return current;
		}
	};
}

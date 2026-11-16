/**
 * Where a pane beside a screen goes (plan E3, Trevor 2026-11-12, and the board's pane, M86,
 * Trevor 2026-11-15): a column on the right where the screen is wide (a desktop, a tablet on
 * its side), under the content on an upright tablet, and nowhere on a phone, which has room
 * for neither (the mockups in /mnt/project-files/notes-beside/ and game-notes-two-pane/).
 */
export type BesidePlacement = 'side' | 'under';

/** `width` and `height` in px, `rem` the root font size in px. */
export function besidePlacement(
	width: number,
	height: number,
	rem: number
): BesidePlacement | undefined {
	if (!width) return undefined;
	if (width >= 50 * rem) return 'side';
	if (width >= 36 * rem && height >= 50 * rem) return 'under';
	return undefined;
}

/** The root font size in px, so the thresholds follow the text size setting. */
export function rootRem(): number {
	if (typeof document === 'undefined') return 16;
	return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

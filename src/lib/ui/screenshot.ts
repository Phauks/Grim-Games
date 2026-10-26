/**
 * A picture of part of the page exactly as it is drawn (Trevor, 2026-10-26: Download image
 * "should take an actual copy of the game below and screenshot it", so a change to the board
 * shows in the picture with no extra work). The browser has no way to screenshot a page
 * without asking to share the screen, so the element is copied into an SVG and drawn on a
 * canvas (modern-screenshot, MIT), fonts and images included.
 *
 * Elements marked `data-screenshot="skip"` (the board's toolbar) are left out.
 */

/** Sharp enough to print, whatever the screen. */
const MIN_SCALE = 2;

function skipped(node: Node): boolean {
	return node instanceof HTMLElement && node.dataset.screenshot === 'skip';
}

export async function screenshot(
	element: HTMLElement,
	type: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<Blob> {
	// Loaded when asked, so the library stays out of the app's first download.
	const { domToBlob } = await import('modern-screenshot');
	await document.fonts?.ready;
	return domToBlob(element, {
		type,
		quality: 0.85,
		scale: Math.max(MIN_SCALE, devicePixelRatio || 1),
		// The page's own background, under a board that lets it show through.
		backgroundColor: getComputedStyle(document.body).backgroundColor,
		filter: (node) => !skipped(node)
	});
}

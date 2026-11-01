/**
 * A picture of part of the page exactly as it is drawn (Trevor, 2026-10-26: Download image
 * "should take an actual copy of the game below and screenshot it", so a change to the board
 * shows in the picture with no extra work). The browser has no way to screenshot a page
 * without asking to share the screen, so the element is copied into an SVG and drawn on a
 * canvas (modern-screenshot, MIT), fonts and images included.
 *
 * Elements marked `data-screenshot="skip"` (the board's toolbar, History's strip, the
 * soundboard and timer) are left out: the picture is the board and its game info only
 * (Trevor, 2026-11-01). They are drawn see-through rather than removed, so the rest keeps its
 * place exactly as on screen.
 */

/** Sharp enough to print, whatever the screen. */
const MIN_SCALE = 2;

function skipped(node: Node): boolean {
	return node instanceof HTMLElement && node.dataset.screenshot === 'skip';
}

/** The page's own colour: the body is see-through over the theme's backdrop, so the page's. */
function pageBackground(): string {
	const body = getComputedStyle(document.body).backgroundColor;
	const clear = body === 'transparent' || /^rgba\(.*,\s*0\)$/.test(body);
	return clear ? getComputedStyle(document.documentElement).backgroundColor : body;
}

/** A part of the element, in CSS pixels from its top. */
export interface Band {
	top: number;
	height: number;
}

export interface ScreenshotOptions {
	/** Pixels per CSS pixel; at least MIN_SCALE. */
	scale?: number;
	/** What shows through the element; the page's own background otherwise. */
	backgroundColor?: string;
	/** Only this band of the element, such as the board without the room kept for its controls. */
	band?: Band;
}

export async function screenshot(
	element: HTMLElement,
	type: 'image/png' | 'image/jpeg' = 'image/png',
	options: ScreenshotOptions = {}
): Promise<Blob> {
	// Loaded when asked, so the library stays out of the app's first download.
	const { domToCanvas } = await import('modern-screenshot');
	await document.fonts?.ready;
	const scale = Math.max(MIN_SCALE, options.scale ?? 0, devicePixelRatio || 1);
	const drawn = await domToCanvas(element, {
		scale,
		// The page's own background, under a board that lets it show through.
		backgroundColor: options.backgroundColor ?? pageBackground(),
		// Opacity, not visibility: every copied node carries its own visibility.
		onCloneEachNode: (node) => {
			if (skipped(node)) (node as HTMLElement).style.opacity = '0';
		}
	});
	const canvas = options.band ? cut(drawn, options.band, scale) : drawn;
	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('could not draw the picture'))),
			type,
			0.85
		)
	);
}

/**
 * A picture of `part` (inside `element`) with its own top margin all round: the board without
 * the toolbar's row above it or the room below it for the reminder bank or History's strip.
 */
export function screenshotPart(
	element: HTMLElement,
	part: HTMLElement,
	type?: 'image/png' | 'image/jpeg'
): Promise<Blob> {
	const margin = parseFloat(getComputedStyle(part).marginTop) || 0;
	const top = part.getBoundingClientRect().top - element.getBoundingClientRect().top;
	return screenshot(element, type, {
		band: { top: top - margin, height: part.offsetHeight + 2 * margin }
	});
}

/** The band of the canvas, kept within it. */
function cut(canvas: HTMLCanvasElement, band: Band, scale: number): HTMLCanvasElement {
	const top = Math.max(0, Math.round(band.top * scale));
	const height = Math.min(canvas.height - top, Math.round(band.height * scale));
	if (height <= 0 || (top === 0 && height === canvas.height)) return canvas;
	const out = document.createElement('canvas');
	out.width = canvas.width;
	out.height = height;
	out.getContext('2d')?.drawImage(canvas, 0, -top);
	return out;
}

/** A picture as a data: URL, to put inside a file such as a game recap. */
export function dataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error ?? new Error('could not read the image'));
		reader.readAsDataURL(blob);
	});
}

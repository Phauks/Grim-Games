/**
 * Where a picture sits in the middle of a QR code, in whole modules (the code's squares).
 * Trevor, 2026-10-23: the logo's backing must end exactly on the squares' lines, or slivers
 * of the squares it partly covers show round its edges. So the backing covers whole modules,
 * centred, and no more than its share of the code's width and height (the scanning cap).
 */
export interface QrCentreBox {
	/** The first covered column and row, counted from 0. */
	x: number;
	y: number;
	/** How many columns and rows it covers. */
	width: number;
	height: number;
}

/**
 * The covered modules of a code `modules` squares across, for a box at most `widthShare` and
 * `heightShare` of it (0 to 1). A QR code is always an odd number of modules across, so an
 * odd span centres exactly; each span is the largest odd count within its share, at least 1.
 */
export function qrCentreBox(
	modules: number,
	widthShare: number,
	heightShare = widthShare
): QrCentreBox {
	const span = (share: number) => {
		const most = Math.floor(modules * share);
		return Math.max(1, most % 2 === modules % 2 ? most : most - 1);
	};
	const width = span(widthShare);
	const height = span(heightShare);
	return { x: (modules - width) / 2, y: (modules - height) / 2, width, height };
}

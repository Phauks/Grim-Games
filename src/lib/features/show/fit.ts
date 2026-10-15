export interface TokenFit {
	/** Token diameter in px. */
	size: number;
	columns: number;
}

/**
 * The largest token size that fits `count` tokens, each with a name line of `labelHeight`
 * under it, into a `width` x `height` area, trying every column count.
 */
export function fitTokens(
	count: number,
	width: number,
	height: number,
	{ gap = 16, labelHeight = 40, max = 320, min = 64 } = {}
): TokenFit {
	if (count <= 0 || width <= 0 || height <= 0) return { size: min, columns: 1 };
	let best: TokenFit = { size: 0, columns: 1 };
	for (let columns = 1; columns <= count; columns++) {
		const rows = Math.ceil(count / columns);
		const byWidth = (width - gap * (columns - 1)) / columns;
		const byHeight = (height - gap * (rows - 1)) / rows - labelHeight;
		const size = Math.min(byWidth, byHeight, max);
		if (size > best.size) best = { size, columns };
	}
	return { size: Math.max(min, Math.floor(best.size)), columns: best.columns };
}

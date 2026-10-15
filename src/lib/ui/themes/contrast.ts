/** WCAG 2.x contrast helpers for theme token tests. */

type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb {
	const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
	if (!match) throw new Error(`Not an opaque hex colour: ${hex}`);
	const digits =
		match[1].length === 3
			? [...match[1]].map((d) => d + d)
			: [match[1].slice(0, 2), match[1].slice(2, 4), match[1].slice(4, 6)];
	return digits.map((d) => parseInt(d, 16)) as Rgb;
}

export function relativeLuminance([r, g, b]: Rgb): number {
	const channel = (value: number) => {
		const c = value / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
	const [light, dark] = [relativeLuminance(parseHex(a)), relativeLuminance(parseHex(b))].sort(
		(x, y) => y - x
	);
	return (light + 0.05) / (dark + 0.05);
}

/** Follows `var(--x)` references through a token table until a literal value. */
export function resolveToken(name: string, table: Record<string, string>, depth = 0): string {
	const value = table[name];
	if (value === undefined) throw new Error(`Undefined token ${name}`);
	const reference = /^var\((--[\w-]+)\)$/.exec(value.trim());
	if (!reference) return value;
	if (depth > 10) throw new Error(`Token cycle at ${name}`);
	return resolveToken(reference[1], table, depth + 1);
}

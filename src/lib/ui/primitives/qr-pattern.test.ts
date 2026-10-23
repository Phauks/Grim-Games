import { describe, expect, it } from 'vitest';
import { encode } from 'uqr';
import { finderOrigins, qrPath } from './qr-pattern.ts';

// Trevor, 2026-10-23: the QR code's squares and corner markers can be drawn in other shapes.
describe('drawing a QR code', () => {
	const matrix = encode('https://grimbinder.com/join/123456', { ecc: 'H' });

	it('finds the three corner markers where the encoder put them', () => {
		for (const [x, y] of finderOrigins(matrix.size)) {
			// A marker's corner and middle are dark; the ring inside its edge is light.
			expect(matrix.data[y][x]).toBe(true);
			expect(matrix.data[y + 3][x + 3]).toBe(true);
			expect(matrix.data[y + 1][x + 1]).toBe(false);
			expect(matrix.types[y + 3][x + 3]).toBe(2);
		}
	});

	it('draws one shape per dark square outside the markers, and three markers', () => {
		const dark = matrix.data.flat().filter(Boolean).length;
		const inMarkers = 3 * (7 * 7 - 5 * 5 + 3 * 3);
		const shapes = (d: string) => d.match(/M/g)!.length;
		// Square markers are three rectangles each (ring edge, hole, middle).
		expect(shapes(qrPath(matrix))).toBe(dark - inMarkers + 9);
		expect(shapes(qrPath(matrix, 'dot', 'circle'))).toBe(dark - inMarkers + 9);
		expect(qrPath(matrix, 'rounded', 'rounded')).toContain('a0.3,0.3');
	});

	it('keeps every shape inside its own square', () => {
		const d = qrPath(matrix, 'dot');
		const starts = [...d.matchAll(/M([\d.]+),([\d.]+)a0\.5,/g)];
		expect(starts.length).toBeGreaterThan(0);
		for (const [, x] of starts) {
			const fraction = Number(x) % 1;
			expect(fraction).toBe(0);
		}
	});
});

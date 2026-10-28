import { describe, expect, it } from 'vitest';
import { drawLaurel, LAUREL_COLOURS, LAUREL_FACE_RADIUS, LAUREL_FORMS } from './laurel.ts';

/** Every number in a shape's path, as [x, y] pairs. */
function points(d: string): [number, number][] {
	const n = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
	return Array.from({ length: n.length / 2 }, (_, i) => [n[2 * i], n[2 * i + 1]]);
}

describe('drawLaurel', () => {
	it.each(LAUREL_FORMS)('draws %s inside the token, clear of the face', (form) => {
		const shapes = drawLaurel({ form, colour: 'gold', closed: true });
		expect(shapes.length).toBeGreaterThan(10);
		for (const shape of shapes) {
			if (shape.shape !== 'path') continue;
			for (const [x, y] of points(shape.d)) {
				expect(x).toBeGreaterThanOrEqual(0);
				expect(x).toBeLessThanOrEqual(100);
				expect(y).toBeGreaterThanOrEqual(0);
				expect(y).toBeLessThanOrEqual(100);
				// Leaves may lean a little over the face's edge, never into its middle.
				expect(Math.hypot(x - 50, y - 50)).toBeGreaterThan(LAUREL_FACE_RADIUS - 6);
			}
		}
	});

	it('paints only in the chosen colour', () => {
		const paints = new Set(
			drawLaurel({ form: 'laurel', colour: 'demon' }).flatMap((s) => [s.fill, s.stroke])
		);
		paints.delete(undefined);
		expect([...paints].every((p) => (LAUREL_COLOURS.demon as readonly string[]).includes(p!))).toBe(
			true
		);
	});

	it('grows with more leaves', () => {
		const few = drawLaurel({ form: 'olive', colour: 'green', leaves: 4 });
		const many = drawLaurel({ form: 'olive', colour: 'green', leaves: 10 });
		expect(many.length).toBeGreaterThan(few.length);
	});
});

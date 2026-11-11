import { describe, expect, it } from 'vitest';
import { drawLaurel, LAUREL_COLOURS, LAUREL_FACE_RADIUS, LAUREL_FORMS } from './laurel.ts';

/** Every number in a shape's path, as [x, y] pairs. */
function points(d: string): [number, number][] {
	const n = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
	return Array.from({ length: n.length / 2 }, (_, i) => [n[2 * i], n[2 * i + 1]]);
}

describe('drawLaurel', () => {
	it.each(LAUREL_FORMS)('draws %s inside the token, clear of the face', (form) => {
		const shapes = drawLaurel({ form, colour: 'gold' });
		// One path per layer, however many leaves: light for a full town.
		expect(shapes.length).toBeGreaterThanOrEqual(4);
		expect(shapes.length).toBeLessThanOrEqual(10);
		expect(shapes.every((shape) => shape.shape === 'path')).toBe(true);
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

	it.each(LAUREL_FORMS)('draws %s the same all the way round, so it can turn', (form) => {
		// Trevor (2026-11-09): the old laurels "overemphasize top and bottom", and should look
		// good while rotated. Leaf points in each quarter of the token stay close in number.
		const quarters = [0, 0, 0, 0];
		for (const shape of drawLaurel({ form, colour: 'gold' })) {
			if (shape.shape !== 'path') continue;
			for (const [x, y] of points(shape.d)) {
				const degrees = (Math.atan2(x - 50, 50 - y) * 180) / Math.PI + 360;
				quarters[Math.floor(degrees / 90) % 4]++;
			}
		}
		expect(Math.min(...quarters) / Math.max(...quarters)).toBeGreaterThan(0.75);
	});

	it('draws the same wreath every time', () => {
		expect(drawLaurel({ form: 'ivy', colour: 'green' })).toEqual(
			drawLaurel({ form: 'ivy', colour: 'green' })
		);
	});

	it('grows with more leaves', () => {
		const few = drawLaurel({ form: 'olive', colour: 'green', leaves: 4 });
		const many = drawLaurel({ form: 'olive', colour: 'green', leaves: 10 });
		const size = (shapes: typeof few) =>
			shapes.reduce((sum, s) => sum + (s.shape === 'path' ? s.d.length : 0), 0);
		expect(size(many)).toBeGreaterThan(size(few));
	});
});

import { describe, expect, it } from 'vitest';
import {
	difference,
	glareRects,
	grayOf,
	homography,
	mapPoint,
	pageSize,
	warp,
	sheetCorners,
	type Point
} from './frame-checks.ts';

/** A frame of `fill`ed pixels, each [r, g, b] chosen by position. */
function frame(width: number, height: number, fill: (x: number, y: number) => number[]) {
	const rgba = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) rgba.set([...fill(x, y), 255], (y * width + x) * 4);
	}
	return rgba;
}

/** A light sheet, a square turned 10 degrees about (80, 60), on a dark table. */
const turn = (10 * Math.PI) / 180;
function onSheet(x: number, y: number): boolean {
	const dx = x - 80;
	const dy = y - 60;
	const u = dx * Math.cos(turn) + dy * Math.sin(turn);
	const v = -dx * Math.sin(turn) + dy * Math.cos(turn);
	return Math.abs(u) < 35 && Math.abs(v) < 35;
}

describe('frame checks', () => {
	it('finds the corners of a turned sheet on a dark table', () => {
		const rgba = frame(160, 120, (x, y) => (onSheet(x, y) ? [230, 220, 200] : [60, 45, 35]));
		const corners = sheetCorners(grayOf(rgba, 160, 120))!;
		const expected = [
			[-35, -35],
			[35, -35],
			[35, 35],
			[-35, 35]
		].map(([u, v]) => ({
			x: 80 + u * Math.cos(turn) - v * Math.sin(turn),
			y: 60 + u * Math.sin(turn) + v * Math.cos(turn)
		}));
		corners.forEach((c, i) => {
			expect(Math.hypot(c.x - expected[i].x, c.y - expected[i].y)).toBeLessThan(3);
		});
	});

	it('has no corners when the sheet fills the view', () => {
		const rgba = frame(160, 120, (x, y) =>
			x % 10 < 3 && y % 10 < 3 ? [40, 40, 40] : [230, 220, 200]
		);
		expect(sheetCorners(grayOf(rgba, 160, 120))).toBeUndefined();
	});

	it('maps one quadrilateral onto another', () => {
		const from: Point[] = [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: 10, y: 10 },
			{ x: 0, y: 10 }
		];
		const to: Point[] = [
			{ x: 5, y: 3 },
			{ x: 25, y: 4 },
			{ x: 24, y: 22 },
			{ x: 4, y: 21 }
		];
		const h = homography(from, to)!;
		from.forEach((p, i) => {
			const m = mapPoint(h, p);
			expect(m.x).toBeCloseTo(to[i].x, 6);
			expect(m.y).toBeCloseTo(to[i].y, 6);
		});
	});

	it('outlines a patch of glare and nothing else', () => {
		const rgba = frame(120, 90, (x, y) =>
			x >= 30 && x < 54 && y >= 12 && y < 30 ? [255, 255, 252] : [225, 215, 195]
		);
		expect(glareRects(rgba, 120, 90)).toEqual([{ x0: 30, y0: 12, x1: 54, y1: 30 }]);
	});

	it('measures movement between frames', () => {
		const a = grayOf(
			frame(8, 8, () => [100, 100, 100]),
			8,
			8
		);
		const b = grayOf(
			frame(8, 8, () => [110, 110, 110]),
			8,
			8
		);
		expect(difference(a, a)).toBe(0);
		expect(difference(a, b)).toBeCloseTo(10, 0);
	});
});

describe('straightening a sheet', () => {
	it('takes a nearly Letter-shaped sheet as Letter, and a long thin one as it is', () => {
		const letterish = [
			{ x: 10, y: 10 },
			{ x: 95, y: 14 },
			{ x: 92, y: 122 },
			{ x: 12, y: 118 }
		];
		expect(pageSize(letterish, 1600)).toEqual({
			width: Math.round(1600 / (11 / 8.5)),
			height: 1600
		});
		const strip = [
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 100, y: 300 },
			{ x: 0, y: 300 }
		];
		expect(pageSize(strip, 900)).toEqual({ width: 300, height: 900 });
	});

	it('warps a picture by a map, reading each pixel where the map puts it', () => {
		const source = frame(4, 4, (x, y) => [x * 60, y * 60, 0]);
		// Result pixel (x, y) reads source pixel (x + 1, y + 1).
		const shift = [1, 0, 1, 0, 1, 1, 0, 0, 1];
		const out = warp(source, 4, 4, shift, 2, 2);
		expect([...out.slice(0, 4)]).toEqual([60, 60, 0, 255]);
		expect([...out.slice(12, 16)]).toEqual([120, 120, 0, 255]);
	});
});

import { describe, expect, it } from 'vitest';
import {
	centredCrop,
	clampCrop,
	cropRect,
	cropView,
	MAX_AVATAR_ZOOM,
	panCrop,
	zoomCrop
} from './crop.ts';

// The avatar picture's crop screen (Trevor, 2026-10-27: "so players can identify the exact
// contours of the picture they want used").

const wide = { width: 400, height: 200 };

describe("an avatar picture's crop", () => {
	it('starts as the largest square in the middle', () => {
		expect(cropRect(centredCrop(wide), wide)).toEqual({ x: 100, y: 0, side: 200 });
	});

	it('follows a drag, and never leaves the picture', () => {
		// Dragging the picture right by half the square shows more of its left.
		let crop = panCrop(centredCrop(wide), wide, 0.5, 0);
		expect(cropRect(crop, wide)).toEqual({ x: 0, y: 0, side: 200 });
		crop = panCrop(crop, wide, 5, 5);
		expect(cropRect(crop, wide)).toEqual({ x: 0, y: 0, side: 200 });
		crop = panCrop(crop, wide, -10, -10);
		expect(cropRect(crop, wide)).toEqual({ x: 200, y: 0, side: 200 });
	});

	it('zooms about its centre, between the whole height and a quarter of it', () => {
		const crop = zoomCrop(centredCrop(wide), wide, 2);
		expect(cropRect(crop, wide)).toEqual({ x: 150, y: 50, side: 100 });
		expect(zoomCrop(crop, wide, 99).zoom).toBe(MAX_AVATAR_ZOOM);
		expect(zoomCrop(crop, wide, 0.1).zoom).toBe(1);
		// Zoomed in at a corner, zooming out keeps the square inside.
		const corner = panCrop(crop, wide, 10, 10);
		expect(cropRect(zoomCrop(corner, wide, 1), wide)).toEqual({ x: 0, y: 0, side: 200 });
	});

	it('places the picture behind the square in percentages of its side', () => {
		expect(cropView(centredCrop(wide), wide)).toEqual({
			left: -50,
			top: -0,
			width: 200,
			height: 100
		});
		expect(clampCrop({ zoom: 1, x: -5, y: 1000 }, wide)).toEqual({ zoom: 1, x: 100, y: 100 });
	});
});

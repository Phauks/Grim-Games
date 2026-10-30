/**
 * The phones a Test room frame can be (Trevor, 2026-10-30: "mockup sizing for different phones").
 * Each size is the phone's CSS viewport in portrait (its screen's pixels divided by its pixel
 * ratio), as browser device lists such as Chrome DevTools' give it. A frame matches that size
 * only: not the pixel density, the notch or the browser's own bars.
 */
export interface Device {
	id: string;
	name: string;
	width: number;
	height: number;
}

export const DEVICES: readonly Device[] = [
	{ id: 'iphone-se', name: 'iPhone SE', width: 375, height: 667 },
	{ id: 'iphone-15', name: 'iPhone 15', width: 393, height: 852 },
	{ id: 'iphone-15-pro-max', name: 'iPhone 15 Pro Max', width: 430, height: 932 },
	{ id: 'pixel-8', name: 'Pixel 8', width: 412, height: 915 },
	{ id: 'galaxy-s23', name: 'Galaxy S23', width: 360, height: 780 },
	{ id: 'galaxy-fold', name: 'Galaxy Z Fold (folded)', width: 344, height: 882 },
	{ id: 'ipad-mini', name: 'iPad mini', width: 744, height: 1133 }
];

export const deviceById = (id: string): Device | undefined => DEVICES.find((d) => d.id === id);

/** The frames a new Test room starts with: the smallest iPhone, a usual iPhone and a Pixel. */
export const DEFAULT_FRAMES = ['iphone-se', 'iphone-15', 'pixel-8'];

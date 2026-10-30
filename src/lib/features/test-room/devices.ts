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
	{ id: 'iphone-13-mini', name: 'iPhone 13 mini', width: 375, height: 812 },
	{ id: 'iphone-15', name: 'iPhone 15', width: 393, height: 852 },
	{ id: 'iphone-15-pro-max', name: 'iPhone 15 Pro Max', width: 430, height: 932 },
	{ id: 'pixel-8', name: 'Pixel 8', width: 412, height: 915 },
	{ id: 'galaxy-s23', name: 'Galaxy S23', width: 360, height: 780 },
	{ id: 'galaxy-a', name: 'Galaxy A series', width: 360, height: 800 },
	{ id: 'galaxy-fold', name: 'Galaxy Z Fold (folded)', width: 344, height: 882 },
	{ id: 'ipad-mini', name: 'iPad mini', width: 744, height: 1133 }
];

export const deviceById = (id: string): Device | undefined => DEVICES.find((d) => d.id === id);

/** The Storyteller's own screen: a tablet either way round, or a computer window. */
export const STORYTELLER_SCREENS: readonly Device[] = [
	{ id: 'ipad-landscape', name: 'iPad (landscape)', width: 1180, height: 820 },
	{ id: 'ipad-portrait', name: 'iPad (portrait)', width: 820, height: 1180 },
	{ id: 'laptop', name: 'Laptop', width: 1280, height: 800 },
	{ id: 'pixel-8', name: 'Pixel 8', width: 412, height: 915 }
];

/** Devices for `count` players, taking each in turn, so a table has every kind of phone. */
export const mixedDevices = (count: number, start = 0): string[] =>
	Array.from({ length: count }, (_, i) => DEVICES[(start + i) % DEVICES.length].id);

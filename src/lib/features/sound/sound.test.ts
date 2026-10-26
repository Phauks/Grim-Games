import { afterEach, describe, expect, it, vi } from 'vitest';
import { canVibrate } from './sound.ts';

/** A browser with or without the Vibration API, whose main pointer is coarse (touch) or fine. */
function device(vibrate: boolean, pointer: 'coarse' | 'fine' | undefined) {
	vi.stubGlobal('navigator', vibrate ? { vibrate: () => true } : {});
	vi.stubGlobal(
		'matchMedia',
		pointer && ((query: string) => ({ matches: query === `(pointer: ${pointer})` }))
	);
}

describe('canVibrate', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('is true on a phone or tablet with the Vibration API', () => {
		device(true, 'coarse');
		expect(canVibrate()).toBe(true);
	});

	// Trevor (2026-10-18): desktop Chrome has the API but no motor, so Vibrate showed usable.
	it('is false on a laptop or desktop, though the browser has the API', () => {
		device(true, 'fine');
		expect(canVibrate()).toBe(false);
	});

	it('is false without the Vibration API (Safari on iPhone and iPad)', () => {
		device(false, 'coarse');
		expect(canVibrate()).toBe(false);
	});

	it('is false where media queries are unavailable', () => {
		device(true, undefined);
		expect(canVibrate()).toBe(false);
	});
});

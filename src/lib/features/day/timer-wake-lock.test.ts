import { afterEach, describe, expect, it, vi } from 'vitest';
import { keepScreenAwake } from './timer-wake-lock.ts';

// The screen stays on while anyone still wants it (Trevor, 2026-10-27: an offline code on
// screen keeps it on beside the day timer and Public Town).

function fakeWakeLock() {
	const released: number[] = [];
	let made = 0;
	const request = vi.fn(async () => {
		const id = ++made;
		return {
			addEventListener: () => {},
			release: async () => void released.push(id)
		};
	});
	vi.stubGlobal('navigator', { wakeLock: { request } });
	vi.stubGlobal('document', {
		visibilityState: 'visible',
		addEventListener: () => {},
		removeEventListener: () => {}
	});
	return { request, released };
}

describe('keeping the screen awake', () => {
	afterEach(() => {
		keepScreenAwake(false, 'timer');
		keepScreenAwake(false, 'offline-code');
		vi.unstubAllGlobals();
	});

	it('keeps it on until the last holder lets go', async () => {
		const { request, released } = fakeWakeLock();
		keepScreenAwake(true, 'timer');
		keepScreenAwake(true, 'offline-code');
		await new Promise((done) => setTimeout(done, 0));
		expect(request).toHaveBeenCalledTimes(1);
		keepScreenAwake(false, 'offline-code');
		expect(released).toEqual([]);
		keepScreenAwake(false, 'timer');
		expect(released).toEqual([1]);
	});
});

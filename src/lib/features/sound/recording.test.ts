import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEEP_BYTES, recording } from './recording.ts';

/** A context whose decoded recordings are `seconds` long, stereo, at 44.1 kHz. */
function fakeContext(seconds: number) {
	const decodeAudioData = vi.fn(
		async () =>
			({ length: seconds * 44_100, numberOfChannels: 2, duration: seconds }) as AudioBuffer
	);
	return { ctx: { decodeAudioData } as unknown as BaseAudioContext, decodeAudioData };
}

/** Each test its own URLs, as the cache lives for the page (the module). */
let run = 0;
const url = (name: string) => `/sounds/${run}/${name}.mp3`;

describe('recording', () => {
	beforeEach(() => {
		run++;
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(new ArrayBuffer(8)))
		);
	});
	afterEach(() => vi.unstubAllGlobals());

	it('decodes a recording once while it is kept', async () => {
		const { ctx, decodeAudioData } = fakeContext(12);
		const first = await recording(ctx, url('bell'));
		expect(await recording(ctx, url('bell'))).toBe(first);
		expect(decodeAudioData).toHaveBeenCalledTimes(1);
	});

	it('keeps the two most recent two-minute recordings, not every one played', async () => {
		// 120 s of stereo float samples: about 42 MB, so two fit and a third does not.
		const { ctx, decodeAudioData } = fakeContext(120);
		expect(2 * 120 * 44_100 * 2 * 4).toBeLessThanOrEqual(KEEP_BYTES);
		expect(3 * 120 * 44_100 * 2 * 4).toBeGreaterThan(KEEP_BYTES);
		await recording(ctx, url('day'));
		await recording(ctx, url('night'));
		// Day played again: it is now the most recent, so the next one lets night go.
		await recording(ctx, url('day'));
		await recording(ctx, url('rain'));
		expect(decodeAudioData).toHaveBeenCalledTimes(3);
		await recording(ctx, url('day'));
		await recording(ctx, url('rain'));
		expect(decodeAudioData).toHaveBeenCalledTimes(3);
		await recording(ctx, url('night'));
		expect(decodeAudioData).toHaveBeenCalledTimes(4);
	});

	it('is undefined, and tried again next time, when a recording cannot be fetched', async () => {
		const { ctx, decodeAudioData } = fakeContext(12);
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(null, { status: 404 }))
		);
		expect(await recording(ctx, url('missing'))).toBeUndefined();
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(new ArrayBuffer(8)))
		);
		expect(await recording(ctx, url('missing'))).toBeDefined();
		expect(decodeAudioData).toHaveBeenCalledTimes(1);
	});
});

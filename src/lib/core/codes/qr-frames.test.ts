import { describe, expect, it } from 'vitest';
import { fountainFrames, QrFrameCollector } from './qr-frames.ts';

/** A frame as the app shows it: a link to Join game with the frame in its hash. */
const asLink = (frame: string) => `https://example.test/join#q=${frame}`;

/** Seeded bytes that don't compress, like a deflated script. */
function noise(length: number, seed: number): Uint8Array {
	const bytes = new Uint8Array(length);
	for (let i = 0; i < length; i++) {
		seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
		bytes[i] = seed >>> 24;
	}
	return bytes;
}

describe('fountain-code frames', () => {
	it('loops a prime number of frames, so a camera in step with the loop still sees them all', () => {
		// A camera catching every second or third frame saw the same ones each loop when the
		// loop was 3K frames long, and often never decoded (measured, 2026-10-27).
		for (let blocks = 2; blocks <= 17; blocks++) {
			const bytes = noise(blocks * 600 - 1, blocks);
			const frames = fountainFrames(bytes)!;
			for (const step of [2, 3]) {
				for (let start = 0; start < step; start++) {
					const collector = new QrFrameCollector();
					let got: unknown = null;
					// Four loops of the code, the camera catching every `step`th frame.
					for (let i = start; i < frames.length * 4 && !got; i += step) {
						const read = collector.add(asLink(frames[i % frames.length]));
						if (read?.kind === 'bytes') got = read.bytes;
					}
					expect(got, `${blocks} blocks, every ${step}`).toEqual(bytes);
				}
			}
		}
	}, 20_000); // About a second alone, slower beside the rest of the suite.
});

describe('reading codes', () => {
	it('passes a code that is not a frame by, even one shaped like a frame', () => {
		const [frame] = fountainFrames(noise(100, 1))!;
		expect(new QrFrameCollector().add('hello')).toBeNull();
		expect(new QrFrameCollector().add(frame)).toBeNull();
		expect(new QrFrameCollector().add(asLink(frame))?.kind).toBe('bytes');
	});
});

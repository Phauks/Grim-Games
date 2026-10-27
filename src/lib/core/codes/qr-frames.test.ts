import { describe, expect, it } from 'vitest';
import {
	fountainFrames,
	MAX_QR_FRAMES,
	parseQrFrame,
	QR_FRAME_CHARS,
	QrFrameCollector,
	qrFrames,
	qrTextId
} from './qr-frames.ts';

const text = 'https://example.test/play#s=1.' + 'abcdefghij'.repeat(170) + '&o=1';

describe('animated QR frames', () => {
	it('cuts a text into numbered frames of at most the frame size', () => {
		const frames = qrFrames(text)!;
		expect(frames).toHaveLength(Math.ceil(text.length / QR_FRAME_CHARS));
		const parsed = frames.map((f) => parseQrFrame(f)!);
		expect(parsed.map((f) => f.index)).toEqual(frames.map((_, i) => i + 1));
		expect(parsed.every((f) => f.total === frames.length && f.id === qrTextId(text))).toBe(true);
		expect(parsed.every((f) => f.part.length <= QR_FRAME_CHARS)).toBe(true);
		expect(parsed.map((f) => f.part).join('')).toBe(text);
	});

	it('refuses a text that would need too many frames', () => {
		expect(qrFrames('x'.repeat(QR_FRAME_CHARS * MAX_QR_FRAMES))).toHaveLength(MAX_QR_FRAMES);
		expect(qrFrames('x'.repeat(QR_FRAME_CHARS * MAX_QR_FRAMES + 1))).toBeNull();
	});

	it('reads only its own frames', () => {
		expect(parseQrFrame('482913')).toBeNull();
		expect(parseQrFrame('https://example.test/join/482913')).toBeNull();
		expect(parseQrFrame('GB1:abc:0:3:x')).toBeNull();
		expect(parseQrFrame('GB1:abc:4:3:x')).toBeNull();
		expect(parseQrFrame('GB1:abc:2:3:x:y')).toEqual({ id: 'abc', index: 2, total: 3, part: 'x:y' });
	});

	it('collects frames in any order, repeats included, and gives back the text', () => {
		const frames = qrFrames(text)!;
		const collector = new QrFrameCollector();
		const order = [...frames].reverse();
		order.splice(1, 0, frames.at(-1)!);
		const reads = order.map((f) => collector.add(f));
		expect(reads.at(0)).toMatchObject({ kind: 'frame', read: 1, total: frames.length });
		expect(reads.at(1)).toMatchObject({ kind: 'frame', read: 1, total: frames.length });
		expect(reads.at(-1)).toEqual({ kind: 'done', text });
	});

	it('starts again when frames of another text arrive', () => {
		const a = qrFrames(text)!;
		const b = qrFrames(text.replace('abc', 'xyz'))!;
		const collector = new QrFrameCollector();
		collector.add(a[0]);
		expect(collector.add(b[1])).toMatchObject({ kind: 'frame', read: 1, total: b.length });
		let last;
		for (const frame of b) last = collector.add(frame);
		expect(last).toEqual({ kind: 'done', text: text.replace('abc', 'xyz') });
	});

	it('does not give back a text whose frames were damaged', () => {
		const frames = qrFrames(text)!;
		frames[0] = frames[0].slice(0, -1) + '!';
		const collector = new QrFrameCollector();
		const reads = frames.map((f) => collector.add(f));
		expect(reads.at(-1)).toMatchObject({ kind: 'frame', read: 0, total: frames.length });
	});

	it('passes a non-frame by', () => {
		expect(new QrFrameCollector().add('hello')).toBeNull();
	});
});

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
						const read = collector.add(frames[i % frames.length]);
						if (read?.kind === 'bytes') got = read.bytes;
					}
					expect(got, `${blocks} blocks, every ${step}`).toEqual(bytes);
				}
			}
		}
	}, 20_000); // About a second alone, slower beside the rest of the suite.
});

import { describe, expect, it } from 'vitest';
import {
	addRoomImage,
	isImageHash,
	parseRoomImagePath,
	roomImagePath,
	splitUpload
} from './room-images.ts';

const hash = (c: string) => c.repeat(64);

describe('room pictures', () => {
	it('names a picture by its hash in the path', () => {
		expect(roomImagePath('482913', hash('a'))).toBe(`/api/room/482913/image/${hash('a')}`);
		expect(parseRoomImagePath(roomImagePath('482913', hash('a')))).toEqual({
			code: '482913',
			hash: hash('a')
		});
		expect(parseRoomImagePath('/api/room/482913')).toBeUndefined();
		expect(parseRoomImagePath('/api/room/482913/image/abc')).toBeUndefined();
		expect(isImageHash(hash('f'))).toBe(true);
		expect(isImageHash('https://example.com')).toBe(false);
	});

	it('keeps a few, dropping the oldest', () => {
		const stored = [
			{ hash: hash('a'), at: 1 },
			{ hash: hash('b'), at: 2 }
		];
		expect(addRoomImage(stored, hash('c'), 3, 2)).toEqual({
			kept: [
				{ hash: hash('b'), at: 2 },
				{ hash: hash('c'), at: 3 }
			],
			dropped: [hash('a')]
		});
		// The same picture again only moves to the newest.
		expect(addRoomImage(stored, hash('a'), 3, 2)).toEqual({
			kept: [
				{ hash: hash('b'), at: 2 },
				{ hash: hash('a'), at: 3 }
			],
			dropped: []
		});
	});

	it('reads the key ahead of the picture, and nothing else', () => {
		const key = 'ab'.repeat(16);
		const body = new Uint8Array([...new TextEncoder().encode(`${key}\n`), 1, 2, 3]);
		expect(splitUpload(body)).toEqual({ key, image: new Uint8Array([1, 2, 3]) });
		expect(splitUpload(new Uint8Array([1, 2, 3]))).toBeUndefined();
		expect(splitUpload(new TextEncoder().encode(`${'x'.repeat(40)}\n1`))).toBeUndefined();
	});
});

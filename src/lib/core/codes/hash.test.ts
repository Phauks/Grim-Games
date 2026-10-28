import { describe, expect, it } from 'vitest';
import { sha256Hex, toHex } from './hash.ts';

describe('hex digests', () => {
	it('writes each byte as two hex digits', () => {
		expect(toHex(new Uint8Array([0, 15, 16, 255]))).toBe('000f10ff');
	});

	it('hashes text and the same bytes alike', async () => {
		const empty = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
		expect(await sha256Hex('')).toBe(empty);
		expect(await sha256Hex('abc')).toBe(await sha256Hex(new TextEncoder().encode('abc')));
	});
});

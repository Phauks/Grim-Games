import { describe, expect, it } from 'vitest';
import { blockCount, encodePiece, FountainDecoder, pieceBlocks } from './fountain.ts';

// Fountain code for animated QR codes (Trevor, 2026-10-27: faster offline script sharing).

function bytes(length: number, seed = 1): Uint8Array {
	let x = seed;
	return Uint8Array.from({ length }, () => (x = (x * 1103515245 + 12345) >>> 0) >>> 24);
}

const SIZE = 100;
const ID = 0x1234abcd;

function decode(data: Uint8Array, seqs: number[]) {
	const decoder = new FountainDecoder(data.length, SIZE, ID);
	for (const seq of seqs) decoder.add(seq, encodePiece(data, SIZE, seq, ID));
	return decoder;
}

describe('fountain code', () => {
	it('starts with the blocks themselves, so one clean loop is enough', () => {
		const data = bytes(950);
		const k = blockCount(data.length, SIZE);
		expect(k).toBe(10);
		for (let seq = 1; seq <= k; seq++) expect(pieceBlocks(seq, k, ID)).toEqual([seq - 1]);
		const decoder = decode(
			data,
			Array.from({ length: k }, (_, i) => k - i)
		);
		expect(decoder.bytes()).toEqual(data);
	});

	it('mixes blocks into spare pieces, mostly two or more, the same on both phones', () => {
		let mixed = 0;
		for (let seq = 11; seq < 40; seq++) {
			const blocks = pieceBlocks(seq, 10, ID);
			if (blocks.length >= 2) mixed++;
			expect(new Set(blocks).size).toBe(blocks.length);
			expect(pieceBlocks(seq, 10, ID)).toEqual(blocks);
		}
		expect(mixed).toBeGreaterThan(20);
	});

	it('fills missed blocks from spare pieces, in any order', () => {
		const data = bytes(2345, 7);
		const k = blockCount(data.length, SIZE);
		// Every third frame of the first loop missed, then spares read backwards.
		const seen = [
			...Array.from({ length: k }, (_, i) => i + 1).filter((s) => s % 3 !== 0),
			...Array.from({ length: 2 * k }, (_, i) => 3 * k - i)
		];
		const decoder = decode(data, seen);
		expect(decoder.done).toBe(true);
		expect(decoder.bytes()).toEqual(data);
	});

	it('rebuilds the bytes from spare pieces alone', () => {
		const data = bytes(1500, 3);
		const k = blockCount(data.length, SIZE);
		const needed: number[] = [];
		for (let start = 0; start < 20; start++) {
			const decoder = new FountainDecoder(data.length, SIZE, ID + start);
			let seq = k + 1;
			while (!decoder.done && seq < 20 * k) {
				decoder.add(seq, encodePiece(data, SIZE, seq, ID + start));
				seq++;
			}
			expect(decoder.bytes()).toEqual(data);
			needed.push(seq - k - 1);
		}
		needed.sort((a, b) => a - b);
		// LT codes cost more over few blocks; spares alone still finish in under three times K.
		expect(needed[10]).toBeLessThan(3 * k);
	});

	it('reports which blocks are in, and ignores a piece read twice or of the wrong size', () => {
		const data = bytes(300);
		const decoder = new FountainDecoder(data.length, SIZE, ID);
		decoder.add(2, encodePiece(data, SIZE, 2, ID));
		decoder.add(2, encodePiece(data, SIZE, 2, ID));
		decoder.add(1, new Uint8Array(5));
		expect(decoder.known).toBe(1);
		expect(decoder.have).toEqual([false, true, false]);
		expect(decoder.bytes()).toBeUndefined();
	});
});

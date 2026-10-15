import { describe, expect, it } from 'vitest';
import {
	makeRoomCode,
	normaliseRoomCode,
	ROOM_CODE_ALPHABET,
	ROOM_CODE_LENGTH
} from './room-code.ts';

describe('room codes', () => {
	it('accepts lower-case input with surrounding spaces', () => {
		expect(normaliseRoomCode('  abcde ')).toBe('ABCDE');
	});

	it('rejects look-alike characters and wrong lengths', () => {
		expect(normaliseRoomCode('ABCD0')).toBeNull(); // 0 vs O
		expect(normaliseRoomCode('ABCD1')).toBeNull(); // 1 vs I
		expect(normaliseRoomCode('ABCD')).toBeNull();
		expect(normaliseRoomCode('ABCDEF')).toBeNull();
	});

	it('makes codes that it accepts', () => {
		let seed = 0;
		const random = () => (seed = (seed + 0.137) % 1);
		for (let i = 0; i < 50; i++) {
			const code = makeRoomCode(random);
			expect(code).toHaveLength(ROOM_CODE_LENGTH);
			expect(normaliseRoomCode(code)).toBe(code);
		}
	});

	it('never reaches past the alphabet', () => {
		expect(makeRoomCode(() => 0.9999999)).toBe(ROOM_CODE_ALPHABET.at(-1)!.repeat(ROOM_CODE_LENGTH));
	});
});

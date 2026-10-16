import { describe, expect, it } from 'vitest';
import { formatRoomCode, makeRoomCode, normaliseRoomCode, ROOM_CODE_LENGTH } from './room-code.ts';

describe('room codes', () => {
	it('accepts six digits with spaces or dashes between them', () => {
		expect(normaliseRoomCode(' 482 913 ')).toBe('482913');
		expect(normaliseRoomCode('482-913')).toBe('482913');
	});

	it('rejects letters and wrong lengths', () => {
		expect(normaliseRoomCode('48291')).toBeNull();
		expect(normaliseRoomCode('4829130')).toBeNull();
		expect(normaliseRoomCode('48291O')).toBeNull();
		expect(normaliseRoomCode('../../x')).toBeNull();
	});

	it('shows codes as two groups of three', () => {
		expect(formatRoomCode('482913')).toBe('482 913');
	});

	it('makes codes that it accepts, including leading zeros', () => {
		let seed = 0;
		const random = () => (seed = (seed + 0.137) % 1);
		for (let i = 0; i < 50; i++) {
			const code = makeRoomCode(random);
			expect(code).toHaveLength(ROOM_CODE_LENGTH);
			expect(normaliseRoomCode(code)).toBe(code);
		}
		expect(makeRoomCode(() => 0)).toBe('000000');
		expect(makeRoomCode(() => 0.9999999)).toBe('999999');
	});
});

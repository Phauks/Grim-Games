import { describe, expect, it } from 'vitest';
import {
	formatRoomCode,
	makeRoomCode,
	normaliseRoomCode,
	ROOM_CODE_LENGTH,
	scannedRoom
} from './room-code.ts';

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

describe('scanned codes (plan J2)', () => {
	it('reads a code on its own', () => {
		expect(scannedRoom(' 482 913 ')).toEqual({ kind: 'join', code: '482913' });
	});

	it("reads the Share screen's link to Join game, the code in its hash", () => {
		expect(scannedRoom(`https://grimbinder.com/join#${'482913'}`)).toEqual({
			kind: 'join',
			code: '482913'
		});
		expect(scannedRoom(`https://beta.example.dev/app/join/#${'482913'}`)).toEqual({
			kind: 'join',
			code: '482913'
		});
		expect(scannedRoom('https://grimbinder.com/join#48291')).toBeNull();
		expect(scannedRoom('https://grimbinder.com/join')).toBeNull();
	});

	it("reads the Share screen's older players link from any copy of the app", () => {
		expect(scannedRoom('https://grimbinder.com/join/482913')).toEqual({
			kind: 'join',
			code: '482913'
		});
		expect(scannedRoom('https://beta.example.dev/app/join/482913/')).toEqual({
			kind: 'join',
			code: '482913'
		});
	});

	it('reads a Grim view link with its key, and only with one', () => {
		expect(scannedRoom('https://grimbinder.com/watch/482913#k3y')).toEqual({
			kind: 'watch',
			code: '482913',
			key: 'k3y'
		});
		expect(scannedRoom('https://grimbinder.com/watch/482913')).toBeNull();
	});

	it('turns down anything else', () => {
		expect(scannedRoom('hello')).toBeNull();
		expect(scannedRoom('https://grimbinder.com/play#e=bmr')).toBeNull();
		expect(scannedRoom('https://grimbinder.com/join/48291')).toBeNull();
		expect(scannedRoom('javascript:alert(1)//join/482913')).toBeNull();
		expect(scannedRoom('ftp://x/join/482913')).toBeNull();
	});
});

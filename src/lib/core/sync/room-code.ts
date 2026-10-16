/**
 * Live-sync room codes (07-accounts-and-multi-device.md §4.2): six digits (Trevor,
 * 2026-10-16), easy to read aloud across a table and to type on a phone's number pad.
 * Shown as two groups of three ("482 913"); typed with or without spaces or dashes.
 */
export const ROOM_CODE_LENGTH = 6;

const VALID = new RegExp(`^[0-9]{${ROOM_CODE_LENGTH}}$`);

/** Returns the canonical form of a typed code, or `null` if it is not a valid code. */
export function normaliseRoomCode(input: string): string | null {
	const code = input.replace(/[\s-]/g, '');
	return VALID.test(code) ? code : null;
}

/** "482913" → "482 913", for showing a code to people. */
export function formatRoomCode(code: string): string {
	return `${code.slice(0, 3)} ${code.slice(3)}`;
}

/** Makes a random room code. `random` is injectable so tests are deterministic. */
export function makeRoomCode(random: () => number = Math.random): string {
	let code = '';
	for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += Math.floor(random() * 10);
	return code;
}

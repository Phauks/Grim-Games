/**
 * Live-sync room codes (04-architecture.md §8.2): short, upper-case, and free of
 * look-alike characters so they can be read aloud across a table or typed on a phone.
 */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;

const VALID = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/** Returns the canonical form of a typed code, or `null` if it is not a valid code. */
export function normaliseRoomCode(input: string): string | null {
	const code = input.trim().toUpperCase();
	return VALID.test(code) ? code : null;
}

/** Makes a random room code. `random` is injectable so tests are deterministic. */
export function makeRoomCode(random: () => number = Math.random): string {
	let code = '';
	for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
		code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
	}
	return code;
}

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

/** Where a scanned code leads: a room to join, or its view-only grimoire with the key. */
export type ScannedRoom =
	{ kind: 'join'; code: string } | { kind: 'watch'; code: string; key: string };

/**
 * Reads what a phone's camera found (plan J2): a room code on its own, or a link from the
 * Storyteller's Share screen (/join#<code>, or an older /join/<code> or /watch/<code>#<key>),
 * from any copy of the app, so a production phone can scan a beta table's code. Anything else
 * is null.
 */
export function scannedRoom(text: string): ScannedRoom | null {
	const bare = normaliseRoomCode(text.trim());
	if (bare) return { kind: 'join', code: bare };
	let url: URL;
	try {
		url = new URL(text.trim());
	} catch {
		return null;
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
	// The one QR (Trevor, 2026-10-26): Join game, with the code in the hash.
	if (/\/join\/?$/.test(url.pathname)) {
		const code = normaliseRoomCode(decodeURIComponent(url.hash.slice(1)));
		return code ? { kind: 'join', code } : null;
	}
	const match = /\/(join|watch)\/([^/]+)\/?$/.exec(url.pathname);
	const code = match && normaliseRoomCode(decodeURIComponent(match[2]));
	if (!match || !code) return null;
	if (match[1] === 'join') return { kind: 'join', code };
	const key = url.hash.slice(1);
	return key ? { kind: 'watch', code, key } : null;
}

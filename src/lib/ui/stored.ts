/**
 * localStorage that never throws (private windows, blocked storage, a full quota), for every
 * part of the app (component review §4.6, 2026-10-17: about thirty files wrote their own
 * try/catch around it). A stored value that a newer or older build wrote goes through the
 * caller's `parse`, which brings it up to the current version or returns its default; the
 * app is an offline-first PWA, so a newer build can read what an older one saved (CLAUDE.md).
 */

/**
 * A phone frame on the Test room page (features/test-room) is its own device: the page names
 * each frame's window with this prefix, and everything stored through here is kept under that
 * name, so each frame joins a room as its own player. Anywhere else keys are as given.
 */
export const PHONE_FRAME_PREFIX = 'grimbinder-phone-';

function scoped(key: string): string {
	// A window's name; nothing outside a browser.
	const { name } = globalThis as { name?: unknown };
	if (typeof name !== 'string') return key;
	return name.startsWith(PHONE_FRAME_PREFIX) ? `${name}:${key}` : key;
}

/** The value at `key`, as JSON, or undefined when missing, unreadable or storage is blocked. */
export function readStored<T = unknown>(key: string): T | undefined {
	try {
		const raw = globalThis.localStorage?.getItem(scoped(key));
		return raw ? (JSON.parse(raw) as T) : undefined;
	} catch {
		return undefined;
	}
}

/** Stores `value` as JSON (undefined removes it). False when storage refused it. */
export function writeStored(key: string, value: unknown): boolean {
	try {
		if (value === undefined) globalThis.localStorage?.removeItem(scoped(key));
		else globalThis.localStorage?.setItem(scoped(key), JSON.stringify(value));
		return true;
	} catch {
		return false;
	}
}

/** A stored record read through its own parser, which handles old versions and damage. */
export function readParsed<T>(key: string, parse: (raw: unknown) => T): T {
	return parse(readStored(key) ?? null);
}

/** The text at `key` as stored (not JSON), or undefined when missing or storage is blocked. */
export function readStoredText(key: string): string | undefined {
	try {
		return globalThis.localStorage?.getItem(scoped(key)) ?? undefined;
	} catch {
		return undefined;
	}
}

/** Stores plain text (undefined removes it). False when storage refused it. */
export function writeStoredText(key: string, value: string | undefined): boolean {
	try {
		if (value === undefined) globalThis.localStorage?.removeItem(scoped(key));
		else globalThis.localStorage?.setItem(scoped(key), value);
		return true;
	} catch {
		return false;
	}
}

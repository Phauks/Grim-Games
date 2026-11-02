/**
 * A friend code opened while signed out (plan F12): its username waits on this device until
 * the person signs in, then Add friend opens with it. Device storage, never a query string
 * (Worker logs keep query strings). A name left waiting for a day is dropped.
 */
import { readStored, writeStored } from '#lib/ui/stored.ts';
import { normaliseUsername } from '#lib/features/account/account-protocol.ts';

const KEY = 'grim-games:pending-friend';
export const PENDING_FRIEND_TTL_MS = 24 * 60 * 60 * 1000;

interface Stored {
	username: string;
	at: number;
}

/** Keeps `username` for after sign-in. */
export function keepPendingFriend(username: string, now = Date.now()): void {
	writeStored(KEY, { username, at: now } satisfies Stored);
}

/** The waiting username, or undefined when there is none, it's damaged or too old. */
export function pendingFriend(now = Date.now()): string | undefined {
	const stored = readStored<Partial<Stored>>(KEY);
	if (typeof stored?.username !== 'string' || typeof stored.at !== 'number') return undefined;
	if (now - stored.at > PENDING_FRIEND_TTL_MS || stored.at > now) return undefined;
	return normaliseUsername(stored.username) ? stored.username : undefined;
}

export function clearPendingFriend(): void {
	writeStored(KEY, undefined);
}

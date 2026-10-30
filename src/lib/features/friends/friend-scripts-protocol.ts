/**
 * Scripts between friends (plan F9, F10): what the app and the Worker
 * (`worker/friends/scripts.ts`) send each other. Trevor, 2026-10-30: "players should be able
 * to share or publish scripts ... hey, use this script to a friend. Or ... just point at
 * their profile".
 *
 * A script travels as its name and a lasting share hash: `#e=` for an edition, `#bs=` for a
 * BotC Scripts script, or `#s=` with the whole script in it. Never `#c=`, whose stored copy
 * is deleted once nobody opens it for 30 days. Opening one is opening that share link.
 */
import type { FriendAccount } from './friends-protocol.ts';

/** The longest hash kept: a script with every character written out fits many times over. */
export const MAX_SCRIPT_HASH = 128 * 1024;
export const MAX_SCRIPT_NAME = 100;
/** Scripts waiting in an account's "Scripts from friends"; the oldest go first. */
export const MAX_INBOX = 50;
/** Scripts on one profile. */
export const MAX_PUBLISHED = 50;

/** A script as sent or published. */
export interface FriendScript {
	name: string;
	/** Its share hash, with the `#`. */
	hash: string;
}

/** A script a friend sent, waiting on this account's Friends page. */
export interface InboxScript extends FriendScript {
	id: number;
	from: FriendAccount;
	at: number;
}

/** A script on a profile, with when it was published. */
export interface PublishedScript extends FriendScript {
	at: number;
}

/** `GET /api/friends/scripts`. */
export interface FriendScriptsResponse {
	inbox: InboxScript[];
	published: PublishedScript[];
}

/** `POST /api/friends/scripts/send` with `SendScriptRequest`. */
export interface SendScriptRequest extends FriendScript {
	/** The friend's account id. */
	to: string;
}

export type SendScriptResponse = { ok: true } | { ok: false; reason: 'not-friends' };

/** `GET /api/profiles/<username>`: what anyone can see on a profile (never the account id). */
export interface ProfileResponse {
	username: string;
	icon: string | null;
	scripts: PublishedScript[];
}

export const FRIEND_SCRIPTS_API = '/api/friends/scripts';
export const SEND_SCRIPT_API = `${FRIEND_SCRIPTS_API}/send`;
/** `POST { id }`: removes a received script. */
export const DISMISS_SCRIPT_API = `${FRIEND_SCRIPTS_API}/dismiss`;
/** `POST FriendScript`: shows a script on this account's profile. */
export const PUBLISH_SCRIPT_API = `${FRIEND_SCRIPTS_API}/publish`;
/** `POST { hash }`: takes it off again. */
export const UNPUBLISH_SCRIPT_API = `${FRIEND_SCRIPTS_API}/unpublish`;
export const PROFILES_API = '/api/profiles';

export function profileApi(username: string): string {
	return `${PROFILES_API}/${encodeURIComponent(username)}`;
}

/** The username in a Worker path `/api/profiles/<username>`, as typed; undefined for any other. */
export function parseProfilePath(pathname: string): string | undefined {
	const match = /^\/api\/profiles\/([^/]+)\/?$/.exec(pathname);
	if (!match) return undefined;
	try {
		return decodeURIComponent(match[1]);
	} catch {
		return undefined;
	}
}

const LASTING_HASH = /^#(?:e=[a-z]{1,16}|bs=\d{1,9}(?:\/[\w.-]{1,32})?|s=[\w.-]+)$/;

/** Whether `hash` is a lasting share hash this API keeps. */
export function isLastingHash(hash: unknown): hash is string {
	return typeof hash === 'string' && hash.length <= MAX_SCRIPT_HASH && LASTING_HASH.test(hash);
}

/** A script from a request body: the name trimmed and cut short; undefined when it isn't one. */
export function readFriendScript(body: unknown): FriendScript | undefined {
	if (typeof body !== 'object' || body === null) return undefined;
	const { name, hash } = body as Record<string, unknown>;
	if (typeof name !== 'string' || !isLastingHash(hash)) return undefined;
	const trimmed = name.trim().slice(0, MAX_SCRIPT_NAME);
	return trimmed ? { name: trimmed, hash } : undefined;
}

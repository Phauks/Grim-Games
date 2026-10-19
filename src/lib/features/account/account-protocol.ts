/**
 * The accounts API shared by the browser and the Worker (`worker/account/`).
 *
 * Plain TypeScript with no imports: the Worker compiles this file too. Design and storage
 * choice: 07-accounts-and-multi-device.md §2.1. Nothing private ever goes in a URL or query
 * string (Worker logs keep query strings); sign-in links carry their token in the URL hash,
 * which never reaches the server.
 */

/** Sign-in codes are this many digits. */
export const CODE_LENGTH = 6;
/** How long a sign-in code or link works. */
export const CODE_TTL_MS = 10 * 60 * 1000;
/** Wrong codes allowed before the code stops working. */
export const MAX_CODE_ATTEMPTS = 5;
/** Codes one email address can be sent per hour. */
export const MAX_CODES_PER_HOUR = 5;
/** A session ends after this long unused. */
export const SESSION_IDLE_MS = 180 * 24 * 60 * 60 * 1000;
/** Without "Remember me", a session ends when the browser closes, or after this long unused. */
export const SHORT_SESSION_IDLE_MS = 12 * 60 * 60 * 1000;
/** Passwords are at least this long; no other rules (NIST SP 800-63B §3.1.1.2). */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;
/** Wrong passwords allowed for one address per hour before it must wait or use a code. */
export const MAX_PASSWORD_FAILURES = 10;
/**
 * The privacy policy's version: the date on the privacy page ("Last updated"), which shows
 * this value. Creating an account means accepting it (Trevor, 2026-10-18); changing it asks
 * every account to accept again at its next sign-in.
 */
export const PRIVACY_VERSION = '2026-10-18';
/** Name of the HttpOnly session cookie. */
export const SESSION_COOKIE = 'gg_session';

/** Kinds of documents kept in a profile. Saved games come later (ROADMAP 0.99). */
export const DOC_KINDS = ['script'] as const;
export type DocKind = (typeof DOC_KINDS)[number];
/** A profile document's body as JSON text. Scripts are a few KB. */
export const MAX_DOC_BYTES = 1_000_000;
/** Documents per kind in one profile. */
export const MAX_DOCS_PER_KIND = 500;
const DOC_ID = /^[\w-]{1,64}$/;

/**
 * How email can be sent where this build runs:
 * - `email`: a real sender is set up;
 * - `preview`: no email is sent; the code is shown on screen and written to the Worker log
 *   (Previews and local runs only);
 * - `unavailable`: sign-in is switched off until a sender is set up (production today).
 */
export type EmailDelivery = 'email' | 'preview' | 'unavailable';

/**
 * The signed-in user. `id` is the account's own random id and never changes; everything
 * stored for the account hangs off it, so `email` and `username` can change at any time.
 */
export interface AccountUser {
	id: string;
	email: string;
	/** Unique across accounts (ignoring case); null until the user picks one. */
	username: string | null;
	/** The profile icon: an official character's id, or null for the default icon. */
	icon: string | null;
	/** Whether the account has a password; without one, it signs in with emailed codes. */
	hasPassword: boolean;
	createdAt: number;
}

/** `POST /api/account/email/start` body: the new address, which is sent a code. */
export interface ChangeEmailStartRequest {
	email: string;
}
/** `POST /api/account/email/verify` body: the new address and the code sent to it. */
export interface ChangeEmailVerifyRequest {
	email: string;
	code: string;
}
/** `PUT /api/account/icon` body: a character id, or null for the default icon. */
export interface SetIconRequest {
	icon: string | null;
}
/** `PUT /api/account/username` body. */
export interface SetUsernameRequest {
	username: string;
}
/** Answer to a change of email or username: the user as now stored. */
export interface UserResponse {
	user: AccountUser;
}

/** Usernames are this long. */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;

export interface SessionInfo {
	user: AccountUser | null;
	delivery: EmailDelivery;
	/** The account's type: an admin can open the reports inbox (Trevor, 2026-10-18). */
	admin?: boolean;
}

/** `POST /api/auth/start` body. */
export interface StartRequest {
	email: string;
}
/** `POST /api/auth/start` answer. `preview` is only set when `delivery` is `preview`. */
export interface StartResponse {
	delivery: EmailDelivery;
	preview?: { code: string; link: string };
}

/**
 * `POST /api/auth/verify` body: the typed code, or the token from a sign-in link. A
 * `password` sent with it becomes the account's (signing up, or replacing a forgotten one):
 * only whoever holds the code can set it. `remember` false makes a session that ends with
 * the browser.
 */
export type VerifyRequest = ({ code: string } | { token: string }) & {
	email: string;
	password?: string;
	remember?: boolean;
	/** The PRIVACY_VERSION the user accepted, when they were asked to. */
	acceptPrivacy?: string;
};

/** `POST /api/auth/password` body: signing in with a password. */
export interface PasswordSignInRequest {
	email: string;
	password: string;
	remember?: boolean;
	acceptPrivacy?: string;
}

/**
 * The 403 answer to a sign-in that needs the privacy policy accepted first: a new account,
 * or one that accepted an older version. The code or link still works, so the same request
 * is sent again with `acceptPrivacy`.
 */
export interface PrivacyRequired {
	error: string;
	privacy: { version: string; creating: boolean };
}

export function isPrivacyRequired(body: unknown): body is PrivacyRequired {
	const privacy = (body as Partial<PrivacyRequired> | null)?.privacy;
	return (
		typeof privacy === 'object' &&
		privacy !== null &&
		typeof privacy.version === 'string' &&
		typeof privacy.creating === 'boolean'
	);
}

/** `PUT /api/account/password` body. */
export interface SetPasswordRequest {
	password: string;
}

/** One device signed in to the account. */
export interface DeviceSession {
	id: string;
	device: string;
	createdAt: number;
	lastSeenAt: number;
	current: boolean;
	/** Where it was last used, roughly: Cloudflare's guess from the IP, which is never stored. */
	city?: string;
	/** ISO 3166-1 alpha-2, as Cloudflare gives it. */
	country?: string;
}

/** A request's approximate place, as stored for the signed-in devices list. */
export interface DevicePlace {
	city?: string;
	country?: string;
}

/**
 * The approximate place from a Worker request's `cf` object (city and country only; the IP
 * itself is never kept). Undefined when Cloudflare gave neither, as in local development.
 */
export function readPlace(cf: unknown): DevicePlace | undefined {
	if (typeof cf !== 'object' || cf === null) return undefined;
	const { city, country } = cf as Record<string, unknown>;
	const place: DevicePlace = {};
	if (typeof city === 'string' && city.trim()) place.city = city.trim().slice(0, 60);
	if (typeof country === 'string' && /^[A-Z][A-Z0-9]$/.test(country)) place.country = country;
	return place.city || place.country ? place : undefined;
}

/** A stored profile document. `body` is absent once deleted (a tombstone). */
export interface ProfileDoc<T = unknown> {
	id: string;
	kind: DocKind;
	rev: number;
	updatedAt: number;
	deleted: boolean;
	body?: T;
}

/**
 * `PUT /api/account/docs/<kind>/<id>` body. `baseRev` is the revision the device last saw
 * (0 for a new document); the server refuses the write with 409 and its own copy when
 * another device saved in between (07 §3).
 */
export interface PutDocRequest {
	baseRev: number;
	body?: unknown;
	deleted?: boolean;
}

export interface ApiError {
	error: string;
}

export function isDocKind(value: string): value is DocKind {
	return (DOC_KINDS as readonly string[]).includes(value);
}

export function isDocId(value: string): boolean {
	return DOC_ID.test(value);
}

/**
 * A profile icon as sent: a character id (lower-case letters, digits and underscores, as
 * TPI's ids are), or null to clear it. Undefined when it is neither.
 */
export function normaliseIcon(input: unknown): string | null | undefined {
	if (input === null) return null;
	return typeof input === 'string' && /^[a-z0-9_]{1,40}$/.test(input) ? input : undefined;
}

/** A password as typed: kept exactly, but it must be PASSWORD_MIN to PASSWORD_MAX long. */
export function checkPassword(input: unknown): string | undefined {
	if (typeof input !== 'string') return undefined;
	const length = [...input].length;
	return length >= PASSWORD_MIN && length <= PASSWORD_MAX ? input : undefined;
}

/**
 * An email address as typed, trimmed, keeping its capitals for showing and sending (Trevor,
 * 2026-10-18). Undefined when `normaliseEmail` wouldn't accept it.
 */
export function cleanEmail(input: unknown): string | undefined {
	if (typeof input !== 'string' || !normaliseEmail(input)) return undefined;
	return input.trim();
}

/**
 * Email addresses are compared trimmed and lower-cased. Undefined when it doesn't look like
 * an address (one @, something on both sides, a dot in the domain, no spaces, ≤ 254 chars).
 */
export function normaliseEmail(input: unknown): string | undefined {
	if (typeof input !== 'string') return undefined;
	const email = input.trim().toLowerCase();
	if (email.length > 254) return undefined;
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

/**
 * A username as typed, trimmed. Plain letters A-Z, digits, `_`, `-` and `.`, between
 * USERNAME_MIN and USERNAME_MAX long, so no two names can look alike in different scripts.
 * Undefined when it isn't one.
 */
export function normaliseUsername(input: unknown): string | undefined {
	if (typeof input !== 'string') return undefined;
	const name = input.trim();
	if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) return undefined;
	return /^[A-Za-z0-9_.-]+$/.test(name) ? name : undefined;
}

/** Usernames are unique ignoring case: the key a name is claimed by. */
export function usernameKey(name: string): string {
	return name.toLowerCase();
}

/** A sign-in code as typed: digits only, spaces and dashes ignored. */
export function normaliseCode(input: unknown): string | undefined {
	if (typeof input !== 'string') return undefined;
	const code = input.replace(/[\s-]/g, '');
	return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code) ? code : undefined;
}

/** The sign-in link's hash, `#signin=<token>&email=<address>`. */
export function signInHash(email: string, token: string): string {
	return `#signin=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
}

/** Reads a sign-in link's hash. Undefined when the hash isn't one. */
export function readSignInHash(hash: string): { email: string; token: string } | undefined {
	const params = new URLSearchParams(hash.replace(/^#/, ''));
	const token = params.get('signin');
	const email = normaliseEmail(params.get('email'));
	return token && email && /^[\w-]{20,100}$/.test(token) ? { email, token } : undefined;
}

/** A short device name from a User-Agent, for the signed-in devices list. */
export function describeDevice(userAgent: string | null): string {
	const ua = userAgent ?? '';
	const os = /iPhone/.test(ua)
		? 'iPhone'
		: /iPad/.test(ua)
			? 'iPad'
			: /Android/.test(ua)
				? 'Android'
				: /Mac OS X/.test(ua)
					? 'Mac'
					: /Windows/.test(ua)
						? 'Windows'
						: /Linux/.test(ua)
							? 'Linux'
							: '';
	const browser = /Edg\//.test(ua)
		? 'Edge'
		: /Firefox\//.test(ua)
			? 'Firefox'
			: /Chrome\//.test(ua)
				? 'Chrome'
				: /Safari\//.test(ua)
					? 'Safari'
					: '';
	return [browser, os].filter(Boolean).join(' on ') || 'Unknown device';
}

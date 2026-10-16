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

export interface AccountUser {
	id: string;
	email: string;
	createdAt: number;
}

export interface SessionInfo {
	user: AccountUser | null;
	delivery: EmailDelivery;
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

/** `POST /api/auth/verify` body: the typed code, or the token from a sign-in link. */
export type VerifyRequest = { email: string; code: string } | { email: string; token: string };

/** One device signed in to the account. */
export interface DeviceSession {
	id: string;
	device: string;
	createdAt: number;
	lastSeenAt: number;
	current: boolean;
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
 * Email addresses are compared trimmed and lower-cased. Undefined when it doesn't look like
 * an address (one @, something on both sides, a dot in the domain, no spaces, ≤ 254 chars).
 */
export function normaliseEmail(input: unknown): string | undefined {
	if (typeof input !== 'string') return undefined;
	const email = input.trim().toLowerCase();
	if (email.length > 254) return undefined;
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
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

/**
 * The short-code share API, shared by the app and the Worker (plain TypeScript, no app
 * imports). A shared script is stored on our Worker under a six-digit code such as
 * `482913` and deleted 30 days after it was last opened, or earlier by whoever shared it
 * (08-script-loading.md §5.5, §5.7).
 *
 *   POST   /api/share                 body: the script JSON  -> 201 { code, deleteKey }
 *   GET    /api/share/<code>                                 -> 200 { json } | 404
 *   DELETE /api/share/<code>          X-Delete-Key header    -> 204 | 404
 */
import { normaliseDigitCode } from '#lib/core/codes/digit-code.ts';
import { normaliseWordCode } from '#lib/core/codes/word-code.ts';

/** Digits in a script code (Trevor, 2026-10-16). Guessing risk: 08-script-loading.md §5.5. */
export const SHARE_CODE_DIGITS = 6;
/** Words in the four-word codes made before 2026-10-16; still opened, never made. */
const LEGACY_CODE_WORDS = 4;
/** A shared script is deleted this long after it was last opened. */
export const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** The largest script JSON we store (official scripts are a few KB). */
export const MAX_SHARED_BYTES = 256 * 1024;
export const SHARE_API = '/api/share';
export const DELETE_KEY_HEADER = 'X-Delete-Key';

export interface CreatedShare {
	code: string;
	/** Proves the sharer may delete it; kept on their device only. */
	deleteKey: string;
}

/** A six-digit code, or one of the older four-word codes, in canonical form; else null. */
export function normaliseShareCode(input: string): string | null {
	return (
		normaliseDigitCode(input, SHARE_CODE_DIGITS) ?? normaliseWordCode(input, LEGACY_CODE_WORDS)
	);
}

export function shareCodePath(code: string): string {
	return `${SHARE_API}/${code}`;
}

/** The code in a Worker path `/api/share/<code>`, or undefined. */
export function parseShareCodePath(pathname: string): string | undefined {
	const match = /^\/api\/share\/([a-z0-9-]{1,60})\/?$/.exec(pathname);
	return (match && normaliseShareCode(match[1])) ?? undefined;
}

export function readCreatedShare(body: unknown): CreatedShare | undefined {
	if (typeof body !== 'object' || body === null) return undefined;
	const { code, deleteKey } = body as Record<string, unknown>;
	if (typeof code !== 'string' || typeof deleteKey !== 'string') return undefined;
	const canonical = normaliseShareCode(code);
	return canonical ? { code: canonical, deleteKey } : undefined;
}

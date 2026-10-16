/**
 * The short-code share API, shared by the app and the Worker (plain TypeScript, no app
 * imports). A shared script is stored on our Worker under a word code such as
 * `poisoned-drunk-imp-bell` and deleted 90 days after it was last opened, or earlier by
 * whoever shared it (08-script-loading.md §5.7).
 *
 *   POST   /api/share                 body: the script JSON  -> 201 { code, deleteKey }
 *   GET    /api/share/<code>                                 -> 200 { json } | 404
 *   DELETE /api/share/<code>          X-Delete-Key header    -> 204 | 404
 */
import { normaliseWordCode } from '#lib/core/codes/word-code.ts';

/** Words in a script code: 32 random bits (see `wordCodeBits`). */
export const SHARE_CODE_WORDS = 4;
/** A shared script is deleted this long after it was last opened. */
export const SHARE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
/** The largest script JSON we store (official scripts are a few KB). */
export const MAX_SHARED_BYTES = 256 * 1024;
export const SHARE_API = '/api/share';
export const DELETE_KEY_HEADER = 'X-Delete-Key';

export interface CreatedShare {
	code: string;
	/** Proves the sharer may delete it; kept on their device only. */
	deleteKey: string;
}

export function normaliseShareCode(input: string): string | null {
	return normaliseWordCode(input, SHARE_CODE_WORDS);
}

export function shareCodePath(code: string): string {
	return `${SHARE_API}/${code}`;
}

/** The code in a Worker path `/api/share/<code>`, or undefined. */
export function parseShareCodePath(pathname: string): string | undefined {
	const match = /^\/api\/share\/([a-z-]{1,60})\/?$/.exec(pathname);
	return (match && normaliseShareCode(match[1])) ?? undefined;
}

export function readCreatedShare(body: unknown): CreatedShare | undefined {
	if (typeof body !== 'object' || body === null) return undefined;
	const { code, deleteKey } = body as Record<string, unknown>;
	if (typeof code !== 'string' || typeof deleteKey !== 'string') return undefined;
	const canonical = normaliseShareCode(code);
	return canonical ? { code: canonical, deleteKey } : undefined;
}

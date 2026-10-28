/**
 * Short share links for scripts. Official editions and BotC Scripts scripts need no
 * storage (`#e=`, `#bs=`); anything else is stored on our Worker under a six-digit code (`#c=`).
 * If a code can't be made (offline, or the Worker refuses), the long `#s=` link still
 * works. Design: 08-script-loading.md §5.5 and §5.7.
 */
import { toHex } from '#lib/core/codes/hash.ts';
import { scriptToJson, type LoadedScript } from '#lib/core/data/index.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import { fetchJson, fetchWithTimeout } from '#lib/ui/fetch.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import {
	readCreatedShare,
	SHARE_API,
	shareCodePath,
	type CreatedShare
} from './share-codes-api.ts';
import { fetchLinkTarget, ScriptFetchError, type FetchedScript } from './fetch-script.ts';
import type { SavedScript } from './saved-scripts.ts';
import {
	decodeSharedScript,
	SharedLinkError,
	encodeSharedScript,
	offlineCode,
	sharedRefHash,
	type OfflineCode,
	type SharePath,
	type SharedRef
} from './share.ts';

/** What a link is made from: a saved script, or an edition shown before one is chosen. */
export type Shareable = Pick<SavedScript, 'edition' | 'json' | 'source'>;

/**
 * What a script's Share links to, the same on /play and the board's Script sheet (Trevor,
 * 2026-10-23: "parity"): the saved script when there is one, so a BotC Scripts script keeps
 * its own link, otherwise the edition or the script itself.
 */
export function scriptShareable(script: LoadedScript, saved?: Shareable): Shareable {
	return (
		saved ?? {
			edition: script.edition,
			json: script.edition ? [script.edition] : scriptToJson(script),
			source: { kind: 'edition' }
		}
	);
}

/** A link ready to share, and its share code when it has one. */
export interface ShareTarget {
	url: string;
	code?: string;
	/** The same script as an offline code, for phones with no internet (2026-10-26). */
	offline: OfflineCode;
	/** No code could be made (no internet, or the Worker refused): the long link is used. */
	fellBack?: true;
}

/** Fetches the script stored under a share code. */
const SHARED_LINK_ERRORS = {
	tooLarge: 'scripts.error.sharedTooLarge',
	newer: 'scripts.error.shareNewer',
	damaged: 'scripts.error.shareDamaged'
} as const;

async function fetchSharedCode(code: string): Promise<FetchedScript> {
	let response: Response;
	let body: unknown;
	try {
		({ response, body } = await fetchJson(shareCodePath(code), { credentials: 'omit' }));
	} catch {
		throw new ScriptFetchError(t('scripts.error.serverUnreachable'));
	}
	if (response.status === 404) {
		throw new ScriptFetchError(t('scripts.error.noCode'));
	}
	if (response.status === 429) {
		throw new ScriptFetchError(t('scripts.error.tooManyCodes'));
	}
	const json = typeof body === 'object' && body !== null ? (body as { json?: unknown }).json : null;
	if (!response.ok || !Array.isArray(json)) {
		throw new ScriptFetchError(t('scripts.error.codeHttp', { status: response.status }));
	}
	return { text: JSON.stringify(json), source: { kind: 'share', code } };
}

/** Whether a code still exists; opening it also pushes back its expiry. */
async function codeExists(code: string): Promise<boolean> {
	const response = await fetchWithTimeout(shareCodePath(code), { credentials: 'omit' });
	if (response.status === 404) return false;
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return true;
}

async function createShareCode(json: unknown[]): Promise<CreatedShare> {
	const { response, body } = await fetchJson(SHARE_API, {
		method: 'POST',
		credentials: 'omit',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(json)
	});
	const created = response.ok ? readCreatedShare(body) : undefined;
	if (!created) throw new Error(`Share code not made (HTTP ${response.status})`);
	return created;
}

/* Codes this device made, so sharing the same script again reuses its code. Kept in localStorage (a convenience: losing it only means a new code). */
const STORE_KEY = 'grim-games.share-codes';
const STORE_VERSION = 1;
const MAX_STORED = 50;

interface StoredCode extends CreatedShare {
	at: number;
}
interface CodeStore {
	v: typeof STORE_VERSION;
	codes: Record<string, StoredCode>;
}

function readStore(): CodeStore {
	// Unreadable or blocked storage: start again.
	const raw = readStored<Partial<CodeStore>>(STORE_KEY);
	if (raw?.v === STORE_VERSION && typeof raw.codes === 'object') return raw as CodeStore;
	return { v: STORE_VERSION, codes: {} };
}

function writeStore(store: CodeStore): void {
	const entries = Object.entries(store.codes)
		.sort(([, a], [, b]) => b.at - a.at)
		.slice(0, MAX_STORED);
	// Storage full or blocked: the code still works, it just isn't remembered.
	writeStored(STORE_KEY, { v: STORE_VERSION, codes: Object.fromEntries(entries) });
}

async function scriptKey(json: unknown[]): Promise<string> {
	const bytes = new TextEncoder().encode(JSON.stringify(json));
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
	return toHex(digest.slice(0, 12));
}

/** A code for this script: the one it was opened with, one made earlier, or a new one. */
async function codeFor(saved: Shareable): Promise<string> {
	const key = await scriptKey(saved.json);
	const store = readStore();
	const mine = store.codes[key];
	if (mine && (await codeExists(mine.code))) {
		store.codes[key] = { ...mine, at: Date.now() };
		writeStore(store);
		return mine.code;
	}
	delete store.codes[key];
	if (saved.source.kind === 'share' && saved.source.code && (await codeExists(saved.source.code))) {
		writeStore(store);
		return saved.source.code;
	}
	const created = await createShareCode(saved.json);
	store.codes[key] = { ...created, at: Date.now() };
	writeStore(store);
	return created.code;
}

/**
 * The shortest link for a saved script. Makes (or reuses) a six-digit code for custom scripts;
 * if that fails, falls back to the long link with the whole script in it.
 */
export async function shareTargetFor(
	saved: Shareable,
	origin: string,
	path: SharePath = '/play'
): Promise<ShareTarget> {
	const link = (ref: SharedRef) => `${origin}${path}${sharedRefHash(ref)}`;
	const offline = await offlineCode(origin, saved);
	if (saved.edition) {
		return { url: link({ kind: 'edition', edition: saved.edition }), offline };
	}
	if (saved.source.kind === 'botcscripts') {
		const { scriptId, version } = saved.source;
		return {
			url: link({ kind: 'botcscripts', ref: { kind: 'script', scriptId, version } }),
			offline
		};
	}
	try {
		const code = await codeFor(saved);
		return { url: link({ kind: 'code', code }), code, offline };
	} catch {
		// Offline or refused: the long link needs no server.
		const payload = await encodeSharedScript(saved.json);
		return { url: link({ kind: 'inline', payload }), offline, fellBack: true };
	}
}

/** The script a share link points at, as text for the loader (an edition id or JSON). */
export async function fetchSharedRef(ref: SharedRef): Promise<FetchedScript> {
	switch (ref.kind) {
		case 'edition':
			return { text: ref.edition, source: { kind: 'edition' } };
		case 'botcscripts':
			return fetchLinkTarget({ kind: 'botcscripts', ref: ref.ref }, '');
		case 'code':
			return fetchSharedCode(ref.code);
		case 'inline':
			try {
				return {
					text: JSON.stringify(await decodeSharedScript(ref.payload)),
					source: { kind: 'share' }
				};
			} catch (e) {
				if (!(e instanceof SharedLinkError)) throw e;
				throw new ScriptFetchError(t(SHARED_LINK_ERRORS[e.reason]));
			}
	}
}

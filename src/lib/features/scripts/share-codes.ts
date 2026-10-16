/**
 * Short share links for scripts. Official editions and BotC Scripts scripts need no
 * storage (`#e=`, `#bs=`); anything else is stored on our Worker under a word code (`#c=`).
 * If a code can't be made (offline, or the Worker refuses), the long `#s=` link still
 * works. Design: 08-script-loading.md §5.5 and §5.7.
 */
import {
	DELETE_KEY_HEADER,
	readCreatedShare,
	SHARE_API,
	shareCodePath,
	type CreatedShare
} from './share-codes-api.ts';
import { fetchLinkTarget, ScriptFetchError, type FetchedScript } from './fetch-script.ts';
import type { SavedScript } from './saved-scripts.ts';
import {
	decodeSharedScript,
	encodeSharedScript,
	sharedRefHash,
	type SharePath,
	type SharedRef
} from './share.ts';

/** What a link is made from: a saved script, or an edition shown before one is chosen. */
export type Shareable = Pick<SavedScript, 'edition' | 'json' | 'source'>;

/** A link ready to share, and its word code when it has one. */
export interface ShareTarget {
	url: string;
	code?: string;
	/** This device made the code, so it can delete it. */
	canDelete: boolean;
}

/** Fetches the script stored under a word code. */
export async function fetchSharedCode(code: string): Promise<FetchedScript> {
	let response: Response;
	try {
		response = await fetch(shareCodePath(code), { credentials: 'omit' });
	} catch {
		throw new ScriptFetchError('Could not reach the app’s server. Check your connection.');
	}
	if (response.status === 404) {
		throw new ScriptFetchError(
			'No script has this code. Codes end 90 days after they were last used, so ask for a new one.'
		);
	}
	if (response.status === 429) {
		throw new ScriptFetchError('Too many codes tried. Wait a minute, then try again.');
	}
	const body: unknown = await response.json().catch(() => undefined);
	const json = typeof body === 'object' && body !== null ? (body as { json?: unknown }).json : null;
	if (!response.ok || !Array.isArray(json)) {
		throw new ScriptFetchError(`The code could not be read (HTTP ${response.status}).`);
	}
	return { text: JSON.stringify(json), source: { kind: 'share', code } };
}

/** Whether a code still exists; opening it also pushes back its expiry. */
async function codeExists(code: string): Promise<boolean> {
	const response = await fetch(shareCodePath(code), { credentials: 'omit' });
	if (response.status === 404) return false;
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return true;
}

async function createShareCode(json: unknown[]): Promise<CreatedShare> {
	const response = await fetch(SHARE_API, {
		method: 'POST',
		credentials: 'omit',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(json)
	});
	const created = response.ok ? readCreatedShare(await response.json()) : undefined;
	if (!created) throw new Error(`Share code not made (HTTP ${response.status})`);
	return created;
}

/* Codes this device made, so sharing the same script again reuses its code and the sharer
   can delete it. Kept in localStorage (a convenience: losing it only means a new code). */
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
	try {
		const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
		if (raw?.v === STORE_VERSION && typeof raw.codes === 'object') return raw as CodeStore;
	} catch {
		// Unreadable or blocked storage: start again.
	}
	return { v: STORE_VERSION, codes: {} };
}

function writeStore(store: CodeStore): void {
	const entries = Object.entries(store.codes)
		.sort(([, a], [, b]) => b.at - a.at)
		.slice(0, MAX_STORED);
	try {
		localStorage.setItem(
			STORE_KEY,
			JSON.stringify({ v: STORE_VERSION, codes: Object.fromEntries(entries) })
		);
	} catch {
		// Storage full or blocked: the code still works, it just isn't remembered.
	}
}

async function scriptKey(json: unknown[]): Promise<string> {
	const bytes = new TextEncoder().encode(JSON.stringify(json));
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
	return Array.from(digest.slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A code for this script: the one it was opened with, one made earlier, or a new one. */
async function codeFor(saved: Shareable): Promise<{ code: string; canDelete: boolean }> {
	const key = await scriptKey(saved.json);
	const store = readStore();
	const mine = store.codes[key];
	if (mine && (await codeExists(mine.code))) {
		store.codes[key] = { ...mine, at: Date.now() };
		writeStore(store);
		return { code: mine.code, canDelete: true };
	}
	delete store.codes[key];
	if (saved.source.kind === 'share' && saved.source.code && (await codeExists(saved.source.code))) {
		writeStore(store);
		return { code: saved.source.code, canDelete: false };
	}
	const created = await createShareCode(saved.json);
	store.codes[key] = { ...created, at: Date.now() };
	writeStore(store);
	return { code: created.code, canDelete: true };
}

/**
 * The shortest link for a saved script. Makes (or reuses) a word code for custom scripts;
 * if that fails, falls back to the long link with the whole script in it.
 */
export async function shareTargetFor(
	saved: Shareable,
	origin: string,
	path: SharePath = '/play'
): Promise<ShareTarget> {
	const link = (ref: SharedRef) => `${origin}${path}${sharedRefHash(ref)}`;
	if (saved.edition) {
		return { url: link({ kind: 'edition', edition: saved.edition }), canDelete: false };
	}
	if (saved.source.kind === 'botcscripts') {
		const { scriptId, version } = saved.source;
		return {
			url: link({ kind: 'botcscripts', ref: { kind: 'script', scriptId, version } }),
			canDelete: false
		};
	}
	try {
		const { code, canDelete } = await codeFor(saved);
		return { url: link({ kind: 'code', code }), code, canDelete };
	} catch {
		// Offline or refused: the long link needs no server.
		const payload = await encodeSharedScript(saved.json);
		return { url: link({ kind: 'inline', payload }), canDelete: false };
	}
}

/** Deletes a code this device made. Resolves false if it was already gone. */
export async function deleteShareCode(code: string): Promise<boolean> {
	const store = readStore();
	const entry = Object.entries(store.codes).find(([, c]) => c.code === code);
	if (!entry) return false;
	const response = await fetch(shareCodePath(code), {
		method: 'DELETE',
		credentials: 'omit',
		headers: { [DELETE_KEY_HEADER]: entry[1].deleteKey }
	});
	if (!response.ok && response.status !== 404) throw new Error(`HTTP ${response.status}`);
	delete store.codes[entry[0]];
	writeStore(store);
	return response.ok;
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
			return {
				text: JSON.stringify(await decodeSharedScript(ref.payload)),
				source: { kind: 'share' }
			};
	}
}

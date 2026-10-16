/**
 * Getting script text from a file, a link or BotC Scripts. Each returns the text (or parsed
 * JSON) plus where it came from, or throws a `ScriptFetchError` with a message for the
 * Storyteller. Design: 08-script-loading.md §5.2.
 */
import { t } from '#lib/i18n/locale.svelte.ts';
import {
	proxyPath,
	readProxiedSearchPage,
	readProxiedVersion,
	searchPath,
	type BotcScriptsQuery,
	type BotcScriptsRef,
	type BotcScriptsSearchPage
} from './botcscripts-api.ts';
import type { ScriptSource } from './saved-scripts.ts';
import type { LinkTarget } from './script-links.ts';
import { decodeScriptToolPayload, ScriptToolLinkError } from './script-tool-link.ts';

/** Scripts are a few KB; a 201-character homebrew script is still far below this. */
export const MAX_SCRIPT_BYTES = 1_000_000;

export class ScriptFetchError extends Error {
	constructor(
		message: string,
		/** For a blocked link: the page to open so the Storyteller can copy the JSON. */
		readonly openUrl?: string
	) {
		super(message);
		this.name = 'ScriptFetchError';
	}
}

export interface FetchedScript {
	text: string;
	source: ScriptSource;
}

const tooLarge = () => new ScriptFetchError(t('scripts.error.tooLarge'));

/** Files that are plainly not script JSON (pictures, audio, video, PDFs, archives). */
const NOT_TEXT = /^(image|audio|video|font)\/|^application\/(pdf|zip|gzip|x-7z|x-rar|vnd\.)/;

export async function readScriptFile(file: File): Promise<FetchedScript> {
	if (NOT_TEXT.test(file.type)) {
		throw new ScriptFetchError(t('scripts.error.notScript', { name: file.name }));
	}
	if (file.size > MAX_SCRIPT_BYTES) throw tooLarge();
	return { text: await file.text(), source: { kind: 'file', fileName: file.name } };
}

async function fetchLink(url: string, shownUrl: string): Promise<FetchedScript> {
	let response: Response;
	try {
		response = await fetch(url, { credentials: 'omit', redirect: 'follow' });
	} catch {
		// A CORS refusal and being offline look the same to a page.
		throw new ScriptFetchError(
			navigator.onLine === false ? t('scripts.error.offline') : t('scripts.error.blocked'),
			shownUrl
		);
	}
	if (!response.ok) {
		throw new ScriptFetchError(t('scripts.error.http', { status: response.status }), shownUrl);
	}
	const text = await response.text();
	if (text.length > MAX_SCRIPT_BYTES) throw tooLarge();
	return { text, source: { kind: 'link', url: shownUrl } };
}

async function fetchBotcScripts(ref: BotcScriptsRef): Promise<FetchedScript> {
	let response: Response;
	try {
		response = await fetch(proxyPath(ref));
	} catch {
		throw new ScriptFetchError(t('scripts.error.botcUnreachable'));
	}
	const body: unknown = await response.json().catch(() => undefined);
	if (!response.ok) {
		const message =
			typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
				? body.error
				: t('scripts.error.botcLookup', { status: response.status });
		throw new ScriptFetchError(message);
	}
	const version = readProxiedVersion(body);
	if (!version) throw new ScriptFetchError(t('scripts.error.botcUnexpected'));
	return {
		text: JSON.stringify(version.content),
		source: { kind: 'botcscripts', scriptId: version.scriptId, version: version.version }
	};
}

/** Loads whatever `resolveLink` decided. */
export function fetchLinkTarget(target: LinkTarget, typed: string): Promise<FetchedScript> {
	switch (target.kind) {
		case 'invalid':
			return Promise.reject(new ScriptFetchError(target.message));
		case 'botcscripts':
			return fetchBotcScripts(target.ref);
		case 'scripttool':
			return decodeScriptToolPayload(target.payload).then(
				(text) => ({ text, source: { kind: 'link', url: target.url } }),
				(e: unknown) => {
					throw e instanceof ScriptToolLinkError
						? new ScriptFetchError(
								t(
									e.reason === 'tooLarge'
										? 'scripts.error.scriptTooLarge'
										: 'scripts.error.scriptToolDamaged'
								)
							)
						: e;
				}
			);
		case 'fetch':
			return fetchLink(target.url, /^https?:\/\//i.test(typed.trim()) ? typed.trim() : target.url);
	}
}

/** One page of BotC Scripts search results, through our Worker. */
export async function searchBotcScripts(
	query: BotcScriptsQuery,
	page: number,
	signal?: AbortSignal
): Promise<BotcScriptsSearchPage> {
	let response: Response;
	try {
		response = await fetch(searchPath(query, page), { signal });
	} catch (e) {
		if (e instanceof DOMException && e.name === 'AbortError') throw e;
		throw new ScriptFetchError(t('scripts.error.botcUnreachable'));
	}
	const body: unknown = await response.json().catch(() => undefined);
	const found = response.ok ? readProxiedSearchPage(body) : undefined;
	if (!found) throw new ScriptFetchError(t('scripts.error.botcSearch'));
	return found;
}

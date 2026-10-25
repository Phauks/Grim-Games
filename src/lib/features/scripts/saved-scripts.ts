/**
 * Scripts kept on this device: the "Recent" list, and the current script (the most
 * recently used one). Design: 08-script-loading.md §5.4.
 *
 * Records hold the TPI JSON, not the parsed script, so a newer build reparses them with
 * its own loader. They carry `schemaVersion` because a newer build can open records an
 * older build wrote (CLAUDE.md); `scriptId` and `revision` are there for 0.99 cloud sync.
 */
import { BLOODSTAR_ORIGIN } from './bloodstar-api.ts';
import { HOMEBREW_ORIGIN } from './homebrew-scripts-api.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import {
	editionScript,
	editionWikiUrl,
	loadScript,
	type GameData,
	type LoadedScript
} from '#lib/core/data/index.ts';
import { scriptPageUrl } from './botcscripts-api.ts';
import { CAROUSEL_COLLECTION, collectionDocUrl } from './collection-api.ts';
import { CURATED_PAGE } from './curated-api.ts';
import { SCRIPT_TOOL_HOST } from './script-tool-link.ts';

export const SAVED_SCRIPT_VERSION = 1;
/** How many scripts the Recent list keeps. */
export const MAX_SAVED_SCRIPTS = 20;

/** Where a script came from, shown in Recent and used to load it again. */
export type ScriptSource =
	| { kind: 'edition' }
	| { kind: 'paste' }
	/**
	 * Made on the Script builder page. `variationOf`: the script it was edited from, when that
	 * wasn't made from scratch here (Trevor, 2026-10-17: edits are marked as variations, and
	 * what changed can be seen). Added later, so older records lack it.
	 */
	| { kind: 'built'; variationOf?: VariationOf }
	| { kind: 'file'; fileName: string }
	/**
	 * `page`: the script's source page when the link is a file behind one (a Carousel script's
	 * Drive file lives in the collection doc). Added later, so older records lack it.
	 */
	| { kind: 'link'; url: string; page?: string }
	| { kind: 'botcscripts'; scriptId: number; version: string }
	/** `code` is the share code it was opened with, so sharing it again reuses that code. */
	| { kind: 'share'; code?: string }
	/** One version of a campaign's script (Flesh and Bone): game `game` (from 1) of it. */
	| { kind: 'campaign'; campaignId: string; game: number };

/**
 * The script a variation was made from, kept whole so what changed can still be shown after
 * the original is removed. `json` is the original in TPI's format, official editions included.
 */
export interface VariationOf {
	name: string;
	source: ScriptSource;
	json: unknown[];
}

export interface SavedScript {
	schemaVersion: typeof SAVED_SCRIPT_VERSION;
	scriptId: string;
	name: string;
	/** Set for an official edition; `json` is then unused. */
	edition?: string;
	/** The script in TPI's format (`scriptToJson`). */
	json: unknown[];
	source: ScriptSource;
	addedAt: number;
	lastUsedAt: number;
	revision: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Brings a stored record up to the current version. Undefined when it can't be read, or
 * was written by a newer build (it is then left alone, not deleted).
 */
export function migrateSavedScript(raw: unknown): SavedScript | undefined {
	if (!isObject(raw) || typeof raw.scriptId !== 'string') return undefined;
	if (raw.schemaVersion !== SAVED_SCRIPT_VERSION) return undefined;
	if (typeof raw.name !== 'string' || !Array.isArray(raw.json) || !isObject(raw.source)) {
		return undefined;
	}
	return raw as unknown as SavedScript;
}

/** Same script, whatever its source: used so loading a script again moves it to the top. */
export function sameScript(a: Pick<SavedScript, 'edition' | 'json'>, b: typeof a): boolean {
	if (a.edition || b.edition) return a.edition === b.edition;
	return JSON.stringify(a.json) === JSON.stringify(b.json);
}

/** Parses a stored record again with the current loader. */
export function reloadSavedScript(
	saved: Pick<SavedScript, 'edition' | 'json'>,
	data: GameData
): LoadedScript | undefined {
	if (saved.edition) return editionScript(saved.edition, data);
	return loadScript(saved.json, data).script;
}

/** A short description of the source for the Recent list. */
export function describeSource(source: ScriptSource): string {
	switch (source.kind) {
		case 'edition':
			return t('scripts.from.official');
		case 'paste':
			return t('scripts.from.paste');
		case 'built':
			return t('scripts.from.built');
		case 'file':
			return source.fileName;
		case 'link': {
			if (source.page?.startsWith(collectionDocUrl(CAROUSEL_COLLECTION))) {
				return t('scripts.picker.source.collection');
			}
			if (source.page === CURATED_PAGE) return t('scripts.picker.source.curated');
			if (source.page?.startsWith(`${HOMEBREW_ORIGIN}/`))
				return t('scripts.picker.source.homebrew');
			if (source.page?.startsWith(`${BLOODSTAR_ORIGIN}/`))
				return t('scripts.picker.source.bloodstar');
			const host = new URL(source.url).hostname.replace(/^www\./, '');
			return host === SCRIPT_TOOL_HOST ? t('scripts.from.scriptTool') : host;
		}
		case 'botcscripts':
			return t('scripts.from.botcscripts', { version: source.version });
		case 'share':
			return t('scripts.from.share');
		case 'campaign':
			return t('scripts.from.campaign', { number: source.game });
	}
}

/**
 * The script's own page where it came from (Trevor, 2026-10-16: every script links to its
 * source page, never just a site): its BotC Scripts page, its section of a collection doc,
 * the official page that lists it, or the link it was loaded from. Undefined for pasted,
 * file, shared and built-in scripts, which have no page. A base script (`edition`) links its
 * wiki page (Trevor, 2026-10-23).
 */
export function sourcePage(source: ScriptSource, edition?: string): string | undefined {
	switch (source.kind) {
		case 'edition':
			return editionWikiUrl(edition);
		case 'link':
			return source.page ?? (isSpecificPage(source.url) ? source.url : undefined);
		case 'botcscripts':
			return scriptPageUrl(source.scriptId, source.version || undefined);
		default:
			return undefined;
	}
}

/**
 * The script's almanac page (Trevor, backlog P1: an almanac link in the Glossary): the one
 * its own `_meta` names, else a Bloodstar script's, which sits beside its `script.json` as
 * `almanac.html`. Undefined when it has none.
 */
export function almanacPage(
	meta: { almanac?: string } | undefined,
	source: ScriptSource | undefined
): string | undefined {
	const own = meta?.almanac?.trim();
	if (own && isSpecificPage(own)) return own;
	const page = source?.kind === 'link' ? source.page : undefined;
	return page?.startsWith(`${BLOODSTAR_ORIGIN}/`) && page.endsWith('/almanac.html')
		? page
		: undefined;
}

/** An http(s) address that points somewhere on a site, not only at the site itself. */
export function isSpecificPage(url: string): boolean {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return false;
	}
	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
	return parsed.pathname.replace(/\/+$/, '') !== '' || parsed.search !== '' || parsed.hash !== '';
}

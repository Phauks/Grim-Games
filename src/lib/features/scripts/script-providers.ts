/**
 * Where the script picker finds scripts. Each source is a provider with the same shape, so
 * another site can be added as one more provider (Trevor, 2026-10-16):
 * - a local provider lists scripts already on the device or bundled with the app, and the
 *   picker searches, filters and sorts them itself (`picker-rows.ts`);
 * - a remote provider searches a site page by page, which sorts and filters for us.
 * Every row says how to load it (`LoadTarget`), and carries its characters for the preview.
 * Design: 08-script-loading.md §5.6.
 */
import {
	editionScript,
	loadScript,
	OFFICIAL_EDITIONS,
	type GameData
} from '#lib/core/data/index.ts';
import type { ProfileScriptEntry } from '#lib/features/account/profile-scripts.ts';
import type { BotcScriptsQuery, BotcScriptsRef, BotcScriptsSearchPage } from './botcscripts-api.ts';
import type { CuratedScript } from './curated-api.ts';
import { botcRow, pickerRow, type PickerRow, type PickerSource } from './picker-rows.ts';
import {
	reloadSavedScript,
	sameScript,
	type SavedScript,
	type ScriptSource
} from './saved-scripts.ts';

/** How a row's script is loaded when the Storyteller taps Load. */
export type LoadTarget =
	| { kind: 'edition'; edition: string }
	| { kind: 'saved'; saved: SavedScript }
	| { kind: 'json'; json: unknown[]; source: ScriptSource }
	| { kind: 'botcscripts'; ref: BotcScriptsRef };

/** One row of the picker, and how to load it. */
export interface ScriptListing {
	row: PickerRow;
	target: LoadTarget;
	/** What the script is, to mark the current one; undefined when it can't be known yet. */
	identity?: Pick<SavedScript, 'edition' | 'json'>;
	/** Set for Recent rows, which can be removed. */
	saved?: SavedScript;
}

/** Everything the local providers read. */
export interface LocalContext {
	data: GameData;
	curated: readonly CuratedScript[];
	recent: readonly SavedScript[];
	profile: readonly ProfileScriptEntry[];
	/** Names a curated section in the app's words. */
	curatedLabel: (section: string) => string;
	/** Says where a saved script came from. */
	describe: (source: ScriptSource) => string;
}

export interface LocalProvider {
	kind: 'local';
	id: Exclude<PickerSource, 'botc'>;
	listings(context: LocalContext): ScriptListing[];
}

/** One page of a remote search. */
export interface RemotePage {
	page: number;
	count: number;
	hasMore: boolean;
	listings: ScriptListing[];
}

export interface RemoteProvider<Query> {
	kind: 'remote';
	id: Extract<PickerSource, 'botc'>;
	search(query: Query, page: number, data: GameData, signal?: AbortSignal): Promise<RemotePage>;
}

export const officialProvider: LocalProvider = {
	kind: 'local',
	id: 'official',
	listings: ({ data }) =>
		OFFICIAL_EDITIONS.flatMap((edition) => {
			const script = editionScript(edition.id, data);
			return script
				? [
						{
							row: pickerRow(script, `official:${edition.id}`, 'official'),
							target: { kind: 'edition', edition: edition.id },
							identity: { edition: edition.id, json: [] }
						}
					]
				: [];
		})
};

export const curatedProvider: LocalProvider = {
	kind: 'local',
	id: 'curated',
	listings: ({ data, curated, curatedLabel }) =>
		curated.flatMap((entry, i) => {
			const script = loadScript(entry.json, data).script;
			return script
				? [
						{
							row: pickerRow(script, `curated:${i}`, 'curated', curatedLabel(entry.section)),
							target: {
								kind: 'json',
								json: entry.json,
								source: { kind: 'link', url: entry.link }
							},
							identity: { json: entry.json }
						}
					]
				: [];
		})
};

export const recentProvider: LocalProvider = {
	kind: 'local',
	id: 'recent',
	listings: ({ data, recent, describe }) =>
		recent.flatMap((saved) => {
			if (saved.edition) return [];
			const script = reloadSavedScript(saved, data);
			return script
				? [
						{
							row: pickerRow(script, `recent:${saved.scriptId}`, 'recent', describe(saved.source)),
							target: { kind: 'saved', saved },
							identity: saved,
							saved
						}
					]
				: [];
		})
};

export const profileProvider: LocalProvider = {
	kind: 'local',
	id: 'profile',
	listings: ({ data, profile, describe }) =>
		profile.flatMap((entry) => {
			const script = loadScript(entry.script.json, data).script;
			return script
				? [
						{
							row: pickerRow(
								script,
								`profile:${entry.id}`,
								'profile',
								describe(entry.script.source)
							),
							target: { kind: 'json', json: entry.script.json, source: entry.script.source },
							identity: { json: entry.script.json }
						}
					]
				: [];
		})
};

/** Local sources in the order the table lists them. */
export const LOCAL_PROVIDERS: readonly LocalProvider[] = [
	officialProvider,
	curatedProvider,
	recentProvider,
	profileProvider
];

/** The Scripts page leaves out the base three: they are always in New game (Trevor, 2026-10-16). */
export const SCRIPTS_PAGE_PROVIDERS: readonly LocalProvider[] = [
	curatedProvider,
	recentProvider,
	profileProvider
];

/** Every local row, each script once (the first source to list it wins). */
export function localListings(
	context: LocalContext,
	providers: readonly LocalProvider[] = LOCAL_PROVIDERS
): ScriptListing[] {
	const list: ScriptListing[] = [];
	const seen: Pick<SavedScript, 'edition' | 'json'>[] = [];
	for (const provider of providers) {
		for (const listing of provider.listings(context)) {
			const identity = listing.identity;
			if (identity && seen.some((other) => sameScript(other, identity))) continue;
			if (identity) seen.push(identity);
			list.push(listing);
		}
	}
	return list;
}

/** BotC Scripts (botcscripts.com), searched through our Worker. */
export function botcProvider(
	searchPage: (
		query: BotcScriptsQuery,
		page: number,
		signal?: AbortSignal
	) => Promise<BotcScriptsSearchPage>
): RemoteProvider<BotcScriptsQuery> {
	return {
		kind: 'remote',
		id: 'botc',
		async search(query, page, data, signal) {
			const found = await searchPage(query, page, signal);
			return {
				page: found.page,
				count: found.count,
				hasMore: found.hasMore,
				listings: found.results.map((summary) => ({
					row: botcRow(summary, data),
					target: { kind: 'botcscripts', ref: { kind: 'version', versionId: summary.versionId } }
				}))
			};
		}
	};
}

/** Whether a row is the script `saved` holds. */
export function matchesSaved(saved: SavedScript, listing: ScriptListing): boolean {
	if (listing.identity) return sameScript(saved, listing.identity);
	return (
		saved.source.kind === 'botcscripts' &&
		listing.row.source === 'botc' &&
		saved.source.scriptId === listing.row.number &&
		saved.source.version === listing.row.version
	);
}

/** The saved record for a row, if the row's script is in the user's saved scripts. */
export function findSaved(
	saved: readonly SavedScript[],
	listing: ScriptListing
): SavedScript | undefined {
	const own = listing.saved;
	if (own && saved.some((s) => s.scriptId === own.scriptId)) return own;
	return saved.find((s) => matchesSaved(s, listing));
}

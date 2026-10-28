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
	scriptToJson,
	type GameData
} from '#lib/core/data/index.ts';
import type { ProfileScriptEntry } from '#lib/features/account/profile-scripts.ts';
import type { BotcScriptsQuery, BotcScriptsRef, BotcScriptsSearchPage } from './botcscripts-api.ts';
import { scriptPageUrl } from './botcscripts-api.ts';
import type { CollectionScript } from './collection-api.ts';
import type { BloodstarScript } from './bloodstar-api.ts';
import type { HomebrewScript } from './homebrew-scripts-api.ts';
import type { WorldCupStage, WorldCupYear } from './world-cup.ts';
import type { WorldCupScript } from './world-cup.svelte.ts';
import { CURATED_PAGE, type CuratedScript } from './curated-api.ts';
import {
	bloodstarRow,
	botcRow,
	homebrewRow,
	pickerRow,
	type PickerRow,
	type PickerSource
} from './picker-rows.ts';
import {
	reloadSavedScript,
	sameScript,
	sourcePage,
	type SavedScript,
	type ScriptSource
} from './saved-scripts.ts';

/** How a row's script is loaded when the Storyteller taps Load. */
export type LoadTarget =
	| { kind: 'edition'; edition: string }
	| { kind: 'saved'; saved: SavedScript }
	| { kind: 'json'; json: unknown[]; source: ScriptSource }
	| { kind: 'botcscripts'; ref: BotcScriptsRef }
	/** A BOTC HomeBrew Wiki script, fetched by its slug (`homebrew-scripts-api.ts`). */
	| { kind: 'homebrew'; slug: string }
	/** A Bloodstar Clocktica script, fetched by its folders (`bloodstar-api.ts`). */
	| { kind: 'bloodstar'; script: BloodstarScript };

/** One row of the picker, and how to load it. */
export interface ScriptListing {
	row: PickerRow;
	target: LoadTarget;
	/**
	 * What the script is, to mark the current one; undefined when it can't be known yet. JSON
	 * is as saving writes it (`scriptToJson`), so a saved copy matches the row it came from.
	 */
	identity?: Pick<SavedScript, 'edition' | 'json'>;
	/** A PDF of the script its source publishes, for Print: linked, never copied. */
	pdf?: string;
	/** Set for Recent rows, which can be removed. */
	saved?: SavedScript;
}

/** Everything the local providers read. */
export interface LocalContext {
	data: GameData;
	curated: readonly CuratedScript[];
	/** The Carousel Script Collection (`collection-api.ts`). */
	collection?: readonly CollectionScript[];
	/** The BOTC HomeBrew Wiki's scripts (`homebrew-scripts-api.ts`). */
	homebrew?: readonly HomebrewScript[];
	/** Bloodstar Clocktica's published scripts (`bloodstar-api.ts`). */
	bloodstar?: readonly BloodstarScript[];
	recent: readonly SavedScript[];
	profile: readonly ProfileScriptEntry[];
	/** Names a curated section in the app's words. */
	curatedLabel: (section: string) => string;
	/** Names the month a Script of the Month was first seen ("2026-10"). */
	monthLabel?: (seen: string | undefined) => string;
	/** Says where a saved script came from. */
	describe: (source: ScriptSource) => string;
	/** The World Cups' scripts loaded so far (`world-cup.svelte.ts`). */
	worldCups?: Partial<Record<WorldCupYear, readonly WorldCupScript[]>>;
	/** Says which World Cup and how far a script got, e.g. "World Cup 2025 · Winner". */
	worldCupLabel?: (year: WorldCupYear, stage: WorldCupStage) => string;
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

const officialProvider: LocalProvider = {
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

/**
 * The official site's scripts, apart from its Scripts of the Month (Trevor, 2026-10-17: kept
 * apart from the ones it recommends), which `monthProvider` lists, past months included.
 */
function curatedListings(id: 'curated' | 'month'): LocalProvider['listings'] {
	return ({ data, curated, curatedLabel, monthLabel }) =>
		curated.flatMap((entry, i) => {
			if ((entry.section === 'month') !== (id === 'month')) return [];
			const script = loadScript(entry.json, data).script;
			const note =
				id === 'month'
					? (monthLabel?.(entry.seen) ?? entry.seen ?? '')
					: curatedLabel(entry.section);
			return script
				? [
						{
							row: {
								...pickerRow(script, `${id}:${i}`, id, note),
								page: entry.botc ? entry.link : CURATED_PAGE
							},
							target: {
								kind: 'json',
								json: entry.json,
								source: entry.botc
									? { kind: 'botcscripts', ...entry.botc }
									: { kind: 'link', url: entry.link, page: CURATED_PAGE }
							},
							identity: { json: scriptToJson(script) }
						}
					]
				: [];
		});
}

const curatedProvider: LocalProvider = {
	kind: 'local',
	id: 'curated',
	listings: curatedListings('curated')
};

/** Every Script of the Month our copy has seen, this month's first (`mergeCurated`). */
const monthProvider: LocalProvider = {
	kind: 'local',
	id: 'month',
	listings: curatedListings('month')
};

const collectionProvider: LocalProvider = {
	kind: 'local',
	id: 'collection',
	listings: ({ data, collection = [] }) =>
		collection.flatMap((entry) => {
			const script = loadScript(entry.json, data).script;
			return script
				? [
						{
							row: {
								...pickerRow(script, `collection:${entry.link}`, 'collection'),
								page: entry.page
							},
							target: {
								kind: 'json',
								json: entry.json,
								source: { kind: 'link', url: entry.link, page: entry.page }
							},
							identity: { json: scriptToJson(script) },
							...(entry.pdf ? { pdf: entry.pdf } : {})
						}
					]
				: [];
		})
};

/** A Script World Cup's finalists, each loaded from BotC Scripts (`world-cup.ts`). */
function worldCupProvider(year: WorldCupYear): LocalProvider {
	return {
		kind: 'local',
		id: `worldcup${year}`,
		listings: ({ data, worldCups, worldCupLabel }) =>
			(worldCups?.[year] ?? []).flatMap(({ entry, version, json }) => {
				const script = loadScript(json, data).script;
				if (!script) return [];
				const row = pickerRow(
					script,
					`worldcup${year}:${entry.scriptId}`,
					`worldcup${year}`,
					worldCupLabel?.(year, entry.stage) ?? ''
				);
				return [
					{
						row: {
							...row,
							// The World Cup's own names, as BotC Scripts lists them.
							name: row.name || entry.name,
							author: row.author || entry.author,
							number: entry.scriptId,
							version,
							page: scriptPageUrl(entry.scriptId, version || undefined)
						},
						// Our stored copy already holds it (`worker/world-cups.ts`): nothing to fetch.
						target: {
							kind: 'json',
							json,
							source: { kind: 'botcscripts', scriptId: entry.scriptId, version }
						},
						identity: { json: scriptToJson(script) }
					}
				];
			})
	};
}
const worldCup2023Provider = worldCupProvider('2023');
const worldCup2025Provider = worldCupProvider('2025');

/** The BOTC HomeBrew Wiki: listed from its summaries, each script fetched when shown. */
const homebrewProvider: LocalProvider = {
	kind: 'local',
	id: 'homebrew',
	listings: ({ data, homebrew = [] }) =>
		homebrew.map((script) => ({
			row: homebrewRow(script, data),
			target: { kind: 'homebrew', slug: script.slug }
		}))
};

/** Bloodstar Clocktica: listed from its folder names, each script fetched when shown. */
const bloodstarProvider: LocalProvider = {
	kind: 'local',
	id: 'bloodstar',
	listings: ({ bloodstar = [] }) =>
		bloodstar.map((script) => ({
			row: bloodstarRow(script),
			target: { kind: 'bloodstar', script }
		}))
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
							row: {
								...pickerRow(script, `recent:${saved.scriptId}`, 'recent', describe(saved.source)),
								page: sourcePage(saved.source)
							},
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
							row: {
								...pickerRow(
									script,
									`profile:${entry.id}`,
									'profile',
									describe(entry.script.source)
								),
								page: sourcePage(entry.script.source)
							},
							target: { kind: 'json', json: entry.script.json, source: entry.script.source },
							identity: { json: scriptToJson(script) }
						}
					]
				: [];
		})
};

/** Local sources in the order the table lists them. */
const LOCAL_PROVIDERS: readonly LocalProvider[] = [
	officialProvider,
	curatedProvider,
	recentProvider,
	profileProvider
];

/** The Scripts page leaves out the base three: they are always in New game (Trevor, 2026-10-16). */
export const SCRIPTS_PAGE_PROVIDERS: readonly LocalProvider[] = [
	curatedProvider,
	monthProvider,
	collectionProvider,
	worldCup2023Provider,
	worldCup2025Provider,
	homebrewProvider,
	bloodstarProvider,
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
	if (listing.target.kind === 'homebrew' || listing.target.kind === 'bloodstar') {
		return saved.source.kind === 'link' && saved.source.page === listing.row.page;
	}
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

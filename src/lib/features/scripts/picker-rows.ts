/**
 * Rows of the script picker's table: one per script, from any source (`script-providers.ts`).
 * Local sources are searched, filtered and sorted here; BotC Scripts does that on the site,
 * so its rows arrive ready (`botcRow`). Design: 08-script-loading.md §5.6.
 */
import {
	scriptLogo,
	type CharacterType,
	type GameData,
	type LoadedScript
} from '#lib/core/data/index.ts';
import {
	scriptPageUrl,
	type BotcScriptsEntry,
	type BotcScriptsSummary
} from './botcscripts-api.ts';
import { botcCard, looseId } from './botcscripts-cards.ts';
import { bloodstarName, bloodstarPage, type BloodstarScript } from './bloodstar-api.ts';
import { homebrewScriptPage, type HomebrewScript } from './homebrew-scripts-api.ts';

export type PickerSource =
	| 'official'
	| 'curated'
	| 'month'
	| 'collection'
	| 'worldcup2023'
	| 'worldcup2025'
	| 'homebrew'
	| 'bloodstar'
	| 'recent'
	| 'profile'
	| 'campaign'
	| 'botc';

export type ScriptKind = 'Full' | 'Teensyville';

export interface PickerRow {
	/** Unique within the table. */
	key: string;
	name: string;
	/** Empty when the script names no author. */
	author: string;
	source: PickerSource;
	/** The script's logo (`scriptLogo`): TPI's for the base three, else the author's link. */
	logo?: string;
	/** A detail under the name, e.g. the Curated section; empty for none. */
	note: string;
	kind: ScriptKind;
	/** Townsfolk, Outsiders, Minions and Demons on the script. */
	characters: number;
	/**
	 * Set when the listing doesn't say which characters the script has (Bloodstar lists
	 * paths only): Type and Chars show "None" until the script is opened.
	 */
	unsized?: true;
	/** Every character on the script, for the preview. */
	entries: BotcScriptsEntry[];
	/** Votes ("Likes") on BotC Scripts. */
	likes?: number;
	/** The script's number on BotC Scripts, and the version listed. */
	number?: number;
	version?: string;
	/**
	 * The script's own page where it came from (`sourcePage`): never only a site's address.
	 * Undefined for scripts with no page (pasted, from a file).
	 */
	page?: string;
	/** Lower-cased name, author and character names, for search. */
	haystack: string;
}

const PLAYABLE: readonly CharacterType[] = ['townsfolk', 'outsider', 'minion', 'demon'];

/**
 * Teensyville scripts are the small ones built for 5 or 6 players. A script's JSON doesn't
 * say which it is, so we go by size: the official Teensyville scripts have 11 or 12
 * characters, and full scripts at least 20 (our reading of the official Scripts page).
 */
export const TEENSYVILLE_MAX_CHARACTERS = 13;

/**
 * The script's own name, or '' when it has none: the app shows "None" rather than a made-up
 * name (Trevor, 2026-10-16: "do not show custom script").
 */
export function scriptTitle(script: LoadedScript): string {
	return script.meta.name?.trim() || (script.edition ? script.name : '');
}

export function pickerRow(
	script: LoadedScript,
	key: string,
	source: PickerSource,
	note = ''
): PickerRow {
	const characters = script.characters.filter((c) => PLAYABLE.includes(c.type)).length;
	const author = script.meta.author?.trim() ?? '';
	const logo = scriptLogo(script);
	return {
		key,
		name: scriptTitle(script),
		author,
		source,
		...(logo ? { logo } : {}),
		note,
		kind: characters <= TEENSYVILLE_MAX_CHARACTERS ? 'Teensyville' : 'Full',
		characters,
		entries: script.characters.map((c) => ({ id: c.id, name: c.name, team: c.type })),
		haystack: [script.name, author, ...script.characters.map((c) => c.name)]
			.join('\n')
			.toLowerCase()
	};
}

/** A BotC Scripts search result. The site says whether it is Teensyville; we count the rest. */
export function botcRow(summary: BotcScriptsSummary, data: GameData): PickerRow {
	const card = botcCard(summary.characters, data);
	const characters = PLAYABLE.reduce((n, type) => n + (card.counts[type] ?? 0), 0);
	return {
		key: `botc:${summary.versionId}`,
		name: summary.name,
		author: summary.author.trim(),
		source: 'botc',
		...(summary.logo ? { logo: summary.logo } : {}),
		note: '',
		kind:
			summary.type === 'Teensyville' ||
			(summary.type !== 'Full' && characters <= TEENSYVILLE_MAX_CHARACTERS)
				? 'Teensyville'
				: 'Full',
		characters,
		entries: summary.characters,
		likes: summary.score,
		number: summary.scriptId,
		version: summary.version,
		page: scriptPageUrl(summary.scriptId, summary.version),
		haystack: summary.name.toLowerCase()
	};
}

/** A BOTC HomeBrew Wiki script, from its listing: counted from its characters, like `botcRow`. */
export function homebrewRow(script: HomebrewScript, data: GameData): PickerRow {
	const card = botcCard(script.characters, data);
	const characters = PLAYABLE.reduce((n, type) => n + (card.counts[type] ?? 0), 0);
	return {
		key: `homebrew:${script.slug}`,
		name: script.name,
		author: script.author,
		source: 'homebrew',
		...(script.logo ? { logo: script.logo } : {}),
		note: '',
		kind: characters <= TEENSYVILLE_MAX_CHARACTERS ? 'Teensyville' : 'Full',
		characters,
		entries: script.characters,
		page: homebrewScriptPage(script.slug),
		haystack: [
			script.name,
			script.author,
			...card.groups.flatMap((g) => g.characters.map((c) => c.name))
		]
			.join('\n')
			.toLowerCase()
	};
}

/**
 * A Bloodstar Clocktica script, from its folder names alone: its name is the script's folder
 * and its author the user's folder, the only words the site's list has.
 */
export function bloodstarRow(script: BloodstarScript): PickerRow {
	const name = bloodstarName(script.edition);
	return {
		key: `bloodstar:${script.user}/${script.edition}`,
		name,
		author: script.user,
		source: 'bloodstar',
		note: '',
		kind: 'Full',
		characters: 0,
		unsized: true,
		entries: [],
		page: bloodstarPage(script),
		haystack: `${name}\n${script.user}`.toLowerCase()
	};
}

/** The search and header filters, applied to rows on the device the way the site applies them. */
export interface RowFilter {
	term: string;
	/** The sources being searched. */
	sources: readonly PickerSource[];
	kind: ScriptKind | '';
	author?: string;
	/** Character ids every row must have / must not have. */
	include?: readonly string[];
	exclude?: readonly string[];
	oneDemon?: boolean;
	officialOnly?: boolean;
}

export function filterRows(
	rows: readonly PickerRow[],
	filter: RowFilter,
	data?: GameData
): PickerRow[] {
	const words = filter.term.toLowerCase().split(/\s+/).filter(Boolean);
	const author = filter.author?.trim().toLowerCase() ?? '';
	const include = (filter.include ?? []).map(looseId);
	const exclude = (filter.exclude ?? []).map(looseId);
	return rows.filter((row) => {
		if (!filter.sources.includes(row.source)) return false;
		if (filter.kind !== '' && (row.unsized || row.kind !== filter.kind)) return false;
		if (!words.every((word) => row.haystack.includes(word))) return false;
		if (author && !row.author.toLowerCase().includes(author)) return false;
		if (include.length > 0 || exclude.length > 0) {
			const ids = new Set(row.entries.map((e) => looseId(e.id)));
			if (!include.every((id) => ids.has(id)) || exclude.some((id) => ids.has(id))) return false;
		}
		if (data && (filter.oneDemon || filter.officialOnly)) {
			const card = botcCard(row.entries, data);
			if (filter.oneDemon && card.demons.length !== 1) return false;
			if (filter.officialOnly && card.homebrew) return false;
		}
		return true;
	});
}

export type SortColumn = 'name' | 'author' | 'source' | 'kind' | 'characters' | 'likes' | 'number';
export interface RowSort {
	column: SortColumn;
	descending: boolean;
}

const SOURCE_ORDER: readonly PickerSource[] = [
	'official',
	'curated',
	'month',
	'collection',
	'worldcup2023',
	'worldcup2025',
	'homebrew',
	'bloodstar',
	'recent',
	'profile',
	'botc'
];

function compare(a: PickerRow, b: PickerRow, column: SortColumn): number {
	switch (column) {
		case 'characters':
			return a.characters - b.characters;
		case 'likes':
			return (a.likes ?? 0) - (b.likes ?? 0);
		case 'number':
			return (a.number ?? 0) - (b.number ?? 0);
		case 'source':
			return SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source);
		case 'author':
			// Scripts without an author go last either way round.
			if (!a.author !== !b.author) return a.author ? -1 : 1;
			return a.author.localeCompare(b.author, undefined, { sensitivity: 'base' });
		default:
			return a[column].localeCompare(b[column], undefined, { sensitivity: 'base' });
	}
}

/** Sorted by one column, ties by name; without a sort, rows keep their source order. */
export function sortRows(rows: readonly PickerRow[], sort: RowSort | undefined): PickerRow[] {
	if (!sort) return [...rows];
	const sign = sort.descending ? -1 : 1;
	return [...rows].sort((a, b) => {
		const primary = compare(a, b, sort.column);
		if (primary !== 0) {
			const blankAuthor = sort.column === 'author' && !a.author !== !b.author;
			return blankAuthor ? primary : primary * sign;
		}
		return compare(a, b, 'name');
	});
}

/** A header tap: ascending, then descending, then back to source order. */
export function nextSort(current: RowSort | undefined, column: SortColumn): RowSort | undefined {
	if (current?.column !== column) return { column, descending: false };
	return current.descending ? undefined : { column, descending: true };
}

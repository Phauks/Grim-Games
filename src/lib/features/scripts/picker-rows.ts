/**
 * Rows of the script picker's table: one per script, from any source (`script-providers.ts`).
 * Local sources are searched, filtered and sorted here; BotC Scripts does that on the site,
 * so its rows arrive ready (`botcRow`). Design: 08-script-loading.md §5.6.
 */
import type { CharacterType, GameData, LoadedScript } from '#lib/core/data/index.ts';
import type { BotcScriptsEntry, BotcScriptsSummary } from './botcscripts-api.ts';
import { botcCard } from './botcscripts-cards.ts';

export type PickerSource = 'official' | 'curated' | 'recent' | 'profile' | 'botc';

export type ScriptKind = 'Full' | 'Teensyville';

export interface PickerRow {
	/** Unique within the table. */
	key: string;
	name: string;
	/** Empty when the script names no author. */
	author: string;
	source: PickerSource;
	/** A detail under the name, e.g. the Curated section; empty for none. */
	note: string;
	kind: ScriptKind;
	/** Townsfolk, Outsiders, Minions and Demons on the script. */
	characters: number;
	/** Every character on the script, for the preview. */
	entries: BotcScriptsEntry[];
	/** Votes ("Likes") on BotC Scripts. */
	likes?: number;
	/** The script's number on BotC Scripts, and the version listed. */
	number?: number;
	version?: string;
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

export function pickerRow(
	script: LoadedScript,
	key: string,
	source: PickerSource,
	note = ''
): PickerRow {
	const characters = script.characters.filter((c) => PLAYABLE.includes(c.type)).length;
	const author = script.meta.author?.trim() ?? '';
	return {
		key,
		name: script.name,
		author,
		source,
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
		haystack: summary.name.toLowerCase()
	};
}

export interface RowFilter {
	term: string;
	source: PickerSource | 'all';
	kind: ScriptKind | '';
}

export function filterRows(rows: readonly PickerRow[], filter: RowFilter): PickerRow[] {
	const words = filter.term.toLowerCase().split(/\s+/).filter(Boolean);
	return rows.filter(
		(row) =>
			(filter.source === 'all' || row.source === filter.source) &&
			(filter.kind === '' || row.kind === filter.kind) &&
			words.every((word) => row.haystack.includes(word))
	);
}

export type SortColumn = 'name' | 'author' | 'source' | 'kind' | 'characters' | 'likes' | 'number';
export interface RowSort {
	column: SortColumn;
	descending: boolean;
}

const SOURCE_ORDER: readonly PickerSource[] = ['official', 'curated', 'recent', 'profile', 'botc'];

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

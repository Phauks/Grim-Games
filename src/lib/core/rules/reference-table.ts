/**
 * Sorting and per-column filters for the Character reference table. Pure functions over
 * `ReferenceEntry`, so the page and its tests share them; the state is plain data the UI
 * remembers on the device (`parseTableState` accepts anything stored by an older build).
 */
import { CHARACTER_TYPES, type CharacterType } from '#lib/core/data/types.ts';
import { atSetup, type ReferenceEntry } from './reference.ts';

export const TABLE_COLUMNS = [
	'name',
	'type',
	'edition',
	'alignment',
	'firstNight',
	'otherNight',
	'tokens',
	'setup',
	'jinxes',
	'preDay'
] as const;
export type TableColumn = (typeof TABLE_COLUMNS)[number];

export type SortDirection = 'ascending' | 'descending';
export interface TableSort {
	column: TableColumn;
	direction: SortDirection;
}

/** `yes`: has one (wakes, has tokens, ...); `no`: has none. */
export type Presence = 'yes' | 'no';
/**
 * The Tokens filter also splits characters with tokens into those with a token placed at
 * setup and those with none (Trevor, 2026-10-17).
 */
export type TokensFilter = Presence | 'setup' | 'not-setup';
const TOKENS_FILTERS: readonly TokensFilter[] = ['yes', 'no', 'setup', 'not-setup'];

export interface TableFilters {
	name?: string;
	types?: CharacterType[];
	/** TPI edition ids (`tb`, `bmr`, ...); a character matches any of them (Trevor, 2026-10-18). */
	editions?: string[];
	/** The starting alignment as shown: Good, Evil, Storyteller chooses, None. */
	alignment?: string;
	firstNight?: Presence;
	otherNight?: Presence;
	tokens?: TokensFilter;
	setup?: Presence;
	jinxes?: Presence;
	preDay?: Presence;
}

export interface TableState {
	/** Undefined: the default order (character type, then TPI's order). */
	sort?: TableSort;
	filters: TableFilters;
}

const PRESENCE_COLUMNS = [
	'firstNight',
	'otherNight',
	'tokens',
	'setup',
	'jinxes',
	'preDay'
] as const satisfies readonly TableColumn[];

/** The value a column sorts by; `undefined` (nothing there) always sorts last. */
function sortValue(entry: ReferenceEntry, column: TableColumn): string | number | undefined {
	const c = entry.character;
	switch (column) {
		case 'name':
			return c.name.toLowerCase();
		case 'type':
			return CHARACTER_TYPES.indexOf(c.type);
		case 'edition':
			return c.edition;
		case 'alignment':
			return entry.alignmentNote === 'None' ? undefined : entry.alignmentNote;
		case 'firstNight':
			return entry.firstNight.position;
		case 'otherNight':
			return entry.otherNight.position;
		case 'tokens': {
			const n = c.reminders.length + c.remindersGlobal.length;
			return n || undefined;
		}
		case 'setup':
			return entry.setup?.summary.toLowerCase();
		case 'jinxes':
			return entry.jinxes.length || undefined;
		case 'preDay':
			return entry.dayReminders.length || undefined;
	}
}

function present(entry: ReferenceEntry, column: (typeof PRESENCE_COLUMNS)[number]): boolean {
	return sortValue(entry, column) !== undefined;
}

export function activeFilterCount(filters: TableFilters): number {
	let n = 0;
	if (filters.name?.trim()) n++;
	if (filters.types?.length) n++;
	if (filters.editions?.length) n++;
	if (filters.alignment) n++;
	for (const column of PRESENCE_COLUMNS) if (filters[column]) n++;
	return n;
}

function matchesFilters(entry: ReferenceEntry, filters: TableFilters): boolean {
	const name = filters.name?.trim().toLowerCase();
	if (name && !entry.character.name.toLowerCase().includes(name)) return false;
	if (filters.types?.length && !filters.types.includes(entry.character.type)) return false;
	if (filters.editions?.length && !filters.editions.includes(entry.character.edition ?? ''))
		return false;
	if (filters.alignment && entry.alignmentNote !== filters.alignment) return false;
	for (const column of PRESENCE_COLUMNS) {
		const wanted = filters[column];
		if (wanted === 'setup' || wanted === 'not-setup') {
			const has = entry.tokens.length > 0 && entry.tokens.some(atSetup) === (wanted === 'setup');
			if (!has) return false;
		} else if (wanted && present(entry, column) !== (wanted === 'yes')) return false;
	}
	return true;
}

/** Filtered, then sorted; ties keep the default order. */
export function tableRows(entries: readonly ReferenceEntry[], state: TableState): ReferenceEntry[] {
	const rows = entries.filter((e) => matchesFilters(e, state.filters));
	const sort = state.sort;
	if (!sort) return rows;
	const sign = sort.direction === 'ascending' ? 1 : -1;
	const index = new Map(entries.map((e, i) => [e, i]));
	return rows.sort((a, b) => {
		const x = sortValue(a, sort.column);
		const y = sortValue(b, sort.column);
		if (x === undefined || y === undefined) {
			if (x !== y) return x === undefined ? 1 : -1;
		} else if (x !== y) {
			const order =
				typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
			return sign * order;
		}
		return index.get(a)! - index.get(b)!;
	});
}

/** Tapping a header: ascending, then descending, then ascending again. */
export function nextSort(current: TableSort | undefined, column: TableColumn): TableSort {
	return current?.column === column && current.direction === 'ascending'
		? { column, direction: 'descending' }
		: { column, direction: 'ascending' };
}

/** The alignment choices the filter offers, as `alignmentNote` writes them. */
export const ALIGNMENT_CHOICES = ['Good', 'Evil', 'Storyteller chooses', 'None'] as const;

/** Valid table state from anything (storage from an older build, hand edits, garbage). */
export function parseTableState(raw: unknown): TableState {
	const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const s = (input.sort && typeof input.sort === 'object' ? input.sort : {}) as Record<
		string,
		unknown
	>;
	const sort =
		(TABLE_COLUMNS as readonly unknown[]).includes(s.column) &&
		(s.direction === 'ascending' || s.direction === 'descending')
			? { column: s.column as TableColumn, direction: s.direction as SortDirection }
			: undefined;
	const f = (input.filters && typeof input.filters === 'object' ? input.filters : {}) as Record<
		string,
		unknown
	>;
	const filters: TableFilters = {};
	if (typeof f.name === 'string' && f.name) filters.name = f.name;
	if (Array.isArray(f.types)) {
		const types = f.types.filter((t): t is CharacterType =>
			(CHARACTER_TYPES as readonly unknown[]).includes(t)
		);
		if (types.length) filters.types = types;
	}
	if (Array.isArray(f.editions)) {
		const editions = f.editions.filter((e): e is string => typeof e === 'string' && e !== '');
		if (editions.length) filters.editions = editions;
	}
	if ((ALIGNMENT_CHOICES as readonly unknown[]).includes(f.alignment))
		filters.alignment = f.alignment as string;
	for (const column of PRESENCE_COLUMNS) {
		if (f[column] === 'yes' || f[column] === 'no') filters[column] = f[column];
		else if (column === 'tokens' && TOKENS_FILTERS.includes(f[column] as TokensFilter))
			filters.tokens = f[column] as TokensFilter;
	}
	return { ...(sort ? { sort } : {}), filters };
}

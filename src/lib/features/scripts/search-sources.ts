/**
 * Search's sources (Trevor, 2026-10-18): any of them, on or off, searched together and listed
 * in one table with a Source column. In his order; saved scripts live in the Library. The
 * sources turned on are remembered on the device.
 */
import { readStored, readStoredText, writeStored } from '#lib/ui/stored.ts';
import type { PickerSource } from './picker-rows.ts';

const PAGE_SOURCES = [
	'botc',
	'curated',
	'month',
	'collection',
	'worldcup2023',
	'worldcup2025',
	'homebrew',
	'bloodstar'
] as const satisfies readonly PickerSource[];
export type PageSource = (typeof PAGE_SOURCES)[number];

/**
 * The drop-down's two headings (Trevor, 2026-10-18): search engines keep growing as people
 * publish; collections are sets chosen by someone. The official page's scripts and Scripts of
 * the Month grow only as TPI adds one, so they count as collections.
 */
export type SourceGroup = 'engines' | 'collections';
const SOURCE_GROUP: Record<PageSource, SourceGroup> = {
	botc: 'engines',
	homebrew: 'engines',
	bloodstar: 'engines',
	curated: 'collections',
	month: 'collections',
	collection: 'collections',
	worldcup2023: 'collections',
	worldcup2025: 'collections'
};
/** The drop-down's order: each group together, sources in Trevor's order within it. */
export const GROUPED_SOURCES: readonly PageSource[] = (['engines', 'collections'] as const).flatMap(
	(group) => PAGE_SOURCES.filter((source) => SOURCE_GROUP[source] === group)
);

/** The sources of one group, in the menu's order. */
export function groupSources(group: SourceGroup): PageSource[] {
	return GROUPED_SOURCES.filter((source) => SOURCE_GROUP[source] === group);
}

/** A list of sources in the menu's order, each once; anything unknown is dropped. */
export function orderSources(sources: readonly string[]): PageSource[] {
	return GROUPED_SOURCES.filter((source) => sources.includes(source));
}

const SOURCES_KEY = 'grim-games:scripts:sources';
/** Before sources were toggles, one source was remembered here. */
const OLD_SOURCE_KEY = 'grim-games:scripts:source';

/** The sources turned on: as left last time, else the one source chosen before, else all. */
export function storedSources(): PageSource[] {
	const stored = readStored(SOURCES_KEY);
	if (Array.isArray(stored)) {
		return orderSources(stored.filter((s): s is string => typeof s === 'string'));
	}
	const old = readStoredText(OLD_SOURCE_KEY);
	const one = PAGE_SOURCES.find((s) => s === old);
	return one ? [one] : [...GROUPED_SOURCES];
}

export function keepSources(sources: readonly PageSource[]): void {
	// Storage blocked: the choice lasts for this visit.
	writeStored(SOURCES_KEY, sources);
}

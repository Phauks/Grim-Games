/**
 * Search's sources, one at a time (Trevor, 2026-10-17): mixing them was unfair, since only
 * BotC Scripts has likes and numbers. In his order; saved scripts live in the Library. The
 * last one chosen is remembered on the device.
 */
import { readStoredText, writeStoredText } from '#lib/ui/stored.ts';
import type { PickerSource } from './picker-rows.ts';

export const PAGE_SOURCES = [
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
export const SOURCE_GROUP: Record<PageSource, SourceGroup> = {
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

const SOURCE_KEY = 'grim-games:scripts:source';

export function storedSource(): PageSource {
	const stored = readStoredText(SOURCE_KEY);
	return PAGE_SOURCES.find((s) => s === stored) ?? 'botc';
}

export function keepSource(source: PageSource): void {
	// Storage blocked: the choice lasts for this visit.
	writeStoredText(SOURCE_KEY, source);
}

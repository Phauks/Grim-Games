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
	'homebrew'
] as const satisfies readonly PickerSource[];
export type PageSource = (typeof PAGE_SOURCES)[number];

const SOURCE_KEY = 'grim-games:scripts:source';

export function storedSource(): PageSource {
	const stored = readStoredText(SOURCE_KEY);
	return PAGE_SOURCES.find((s) => s === stored) ?? 'botc';
}

export function keepSource(source: PageSource): void {
	// Storage blocked: the choice lasts for this visit.
	writeStoredText(SOURCE_KEY, source);
}

import { foldForSearch } from '#lib/features/characters/character-search.ts';

/**
 * One setting as Settings shows it, read from the rendered sections (each setting row carries
 * `data-search-label`), so it is always in the interface language and never a second list to
 * keep in step.
 */
export interface SettingEntry {
	/** The section's id, to open it. */
	section: string;
	sectionLabel: string;
	label: string;
	description?: string;
	/** Its place among the section's searchable settings, to find it again once opened. */
	index: number;
}

/**
 * The settings with every word of the query in their name, description or section name,
 * ignoring case and accents. Name matches come first; otherwise Settings' own order is kept.
 * The same name twice in one section (a group and its only row) is listed once. An empty
 * query matches nothing.
 */
export function searchSettings(entries: readonly SettingEntry[], query: string): SettingEntry[] {
	const words = foldForSearch(query).split(/\s+/).filter(Boolean);
	if (words.length === 0) return [];
	const seen = new Set<string>();
	return entries
		.flatMap((entry, i) => {
			const key = `${entry.section}\n${foldForSearch(entry.label)}`;
			if (seen.has(key)) return [];
			const label = foldForSearch(entry.label);
			const all = foldForSearch(
				[entry.label, entry.description ?? '', entry.sectionLabel].join(' ')
			);
			if (!words.every((w) => all.includes(w))) return [];
			seen.add(key);
			return [{ entry, i, rank: words.every((w) => label.includes(w)) ? 0 : 1 }];
		})
		.sort((a, b) => a.rank - b.rank || a.i - b.i)
		.map(({ entry }) => entry);
}

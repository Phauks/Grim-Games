import type { Character, CharacterType } from '#lib/core/data/index.ts';

/** Lower case with accents removed, so "fée" finds "Fee" and "LIL" finds "Lil' Monsta". */
export function foldForSearch(text: string): string {
	return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Whether the character's name or ability text contains every word of the query, ignoring
 * case and accents. An empty query matches everything.
 */
export function matchesSearch(character: Character, query: string): boolean {
	const words = foldForSearch(query).split(/\s+/).filter(Boolean);
	if (words.length === 0) return true;
	// eslint-disable-next-line grim/names-as-badges -- text to search, never shown
	const haystack = foldForSearch(`${character.name} ${character.ability}`);
	return words.every((w) => haystack.includes(w));
}

/**
 * Whether a character's reminder tokens match a reminders picker's search: every word of the
 * query in its name or in one of its tokens' words, ignoring case and accents. The whole row
 * stays, so a token is always seen beside whose it is (Trevor, 2026-10-26).
 */
export function matchesReminderSearch(
	group: { character: Character; labels: readonly string[] },
	query: string
): boolean {
	const words = foldForSearch(query).split(/\s+/).filter(Boolean);
	if (words.length === 0) return true;
	const haystack = foldForSearch([group.character.name, ...group.labels].join(' '));
	return words.every((w) => haystack.includes(w));
}

/** Every character type, in the order the game lists them. */
export const PICKER_TYPES: readonly CharacterType[] = [
	'townsfolk',
	'outsider',
	'minion',
	'demon',
	'traveller',
	'fabled',
	'loric'
];

export interface CharacterGroup {
	type: CharacterType;
	characters: Character[];
}

/** The characters that match, grouped by type in `types` order, name matches first. */
export function searchGroups(
	characters: readonly Character[],
	query: string,
	filter: (c: Character) => boolean = () => true,
	types: readonly CharacterType[] = PICKER_TYPES
): CharacterGroup[] {
	const words = foldForSearch(query).split(/\s+/).filter(Boolean);
	const byName = (c: Character) => {
		const name = foldForSearch(c.name);
		return words.length > 0 && words.every((w) => name.includes(w)) ? 0 : 1;
	};
	// Name matches come before ability-text matches; otherwise the given order is kept.
	const matching = characters
		.filter((c) => filter(c) && matchesSearch(c, query))
		.map((c, i) => ({ c, i, rank: byName(c) }))
		.sort((a, b) => a.rank - b.rank || a.i - b.i)
		.map(({ c }) => c);
	return types
		.map((type) => ({ type, characters: matching.filter((c) => c.type === type) }))
		.filter((g) => g.characters.length > 0);
}

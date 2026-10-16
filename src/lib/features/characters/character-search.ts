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
	const haystack = foldForSearch(`${character.name} ${character.ability}`);
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

/** The characters that match, grouped by type in `types` order, keeping their given order. */
export function searchGroups(
	characters: readonly Character[],
	query: string,
	filter: (c: Character) => boolean = () => true,
	types: readonly CharacterType[] = PICKER_TYPES
): CharacterGroup[] {
	const matching = characters.filter((c) => filter(c) && matchesSearch(c, query));
	return types
		.map((type) => ({ type, characters: matching.filter((c) => c.type === type) }))
		.filter((g) => g.characters.length > 0);
}

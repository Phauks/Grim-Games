import type { Character, CharacterType } from './types.ts';
import { sortByStandardOrder } from './sort-order.ts';

/**
 * The sources a group of characters can be chosen by: TPI's three base scripts and the
 * Carousel, or every source at once (Fabled and Loric have their own edition).
 */
export const GROUP_SOURCES = ['all', 'tb', 'bmr', 'snv', 'carousel'] as const;
export type GroupSource = (typeof GROUP_SOURCES)[number];

/** The group a character belongs to: its own source when it is one of GROUP_SOURCES. */
export function groupSourceOf(character: Pick<Character, 'edition'>): GroupSource {
	return (GROUP_SOURCES as readonly string[]).includes(character.edition ?? '')
		? (character.edition as GroupSource)
		: 'all';
}

/** Every character of one type from one source (or all of them), in TPI's Sort Order. */
export function charactersOfGroup<C extends Character>(
	characters: readonly C[],
	source: GroupSource,
	type: CharacterType
): C[] {
	return sortByStandardOrder(
		characters.filter((c) => c.type === type && (source === 'all' || c.edition === source))
	);
}

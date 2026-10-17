/**
 * TPI's Sort Order for scripts (the update to the "Standard Amy Order"):
 * https://bloodontheclocktower.com/blogs/news/sort-order-sao-update
 *
 * - Character types in order: Townsfolk, Outsiders, Minions, Demons. The article doesn't
 *   cover the others; we put Travellers, Fabled and Loric after them, in that order, sorted
 *   the same way (our choice).
 * - Within a type, by the phrase the ability starts with, in the article's order. An ability
 *   takes the longest listed phrase it starts with ("Each night*" before "Each night"). The
 *   `*` is part of TPI's ability text ("Each night*, choose…"), so it is matched literally.
 * - Abilities that start with none of the phrases come last.
 * - Ties: shorter ability text first, then shorter character name, then alphabetical.
 *
 * Base scripts keep their own order (the article says they predate it), so nothing sorts a
 * script automatically; this is for tools that build or tidy a script.
 */
import { CHARACTER_TYPES, type Character } from './types.ts';

/** The article's phrases, in order. Each is its own rank. */
export const SORT_ORDER_PHRASES: readonly string[] = [
	'You start knowing',
	'At night',
	'Each dusk*',
	'Each night',
	'Each night*',
	'Each day',
	'Once per game, at night',
	'Once per game, at night*',
	'Once per game, during the day',
	'Once per game',
	'On your 1st night',
	'On your 1st day',
	'You think',
	'You are',
	'You have',
	'You do not know',
	'You might',
	'You',
	'When you die',
	'When you learn that you died',
	'When',
	'If you die',
	'If you died',
	'If you are "mad"',
	'If you',
	'If the Demon dies',
	'If the Demon kills',
	'If the Demon',
	'If both',
	'If there are 5 or more players alive',
	'If',
	'All players',
	'All',
	'The 1st time',
	'The',
	'Good',
	'Evil',
	'Players',
	'Minions'
];

/** TPI writes curly quotes ("mad"); compare them as straight ones. */
const plain = (text: string) => text.replace(/[“”]/g, '"');

/** The rank of an ability's opening phrase; past the end when none matches. */
export function sortOrderRank(ability: string): number {
	const text = plain(ability);
	let best = -1;
	SORT_ORDER_PHRASES.forEach((phrase, i) => {
		// A phrase must end at a word boundary: "You" doesn't match "Your".
		if (!text.startsWith(phrase)) return;
		const next = text.charAt(phrase.length);
		if (/[A-Za-z0-9]/.test(next)) return;
		if (best === -1 || phrase.length > SORT_ORDER_PHRASES[best].length) best = i;
	});
	return best === -1 ? SORT_ORDER_PHRASES.length : best;
}

/** Compares two characters in TPI's Sort Order. */
export function compareSortOrder(
	a: Pick<Character, 'type' | 'ability' | 'name'>,
	b: Pick<Character, 'type' | 'ability' | 'name'>
): number {
	return (
		CHARACTER_TYPES.indexOf(a.type) - CHARACTER_TYPES.indexOf(b.type) ||
		sortOrderRank(a.ability) - sortOrderRank(b.ability) ||
		a.ability.length - b.ability.length ||
		a.name.length - b.name.length ||
		a.name.localeCompare(b.name, 'en')
	);
}

/** A copy of the characters in TPI's Sort Order. */
export function sortByStandardOrder<C extends Pick<Character, 'type' | 'ability' | 'name'>>(
	characters: readonly C[]
): C[] {
	return [...characters].sort(compareSortOrder);
}

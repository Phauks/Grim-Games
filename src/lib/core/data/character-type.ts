import type { Alignment, CharacterType } from './types.ts';

/** Types that take a seat. Fabled and Loric are rule characters held on the game, never seated. */
export type SeatableType = Exclude<CharacterType, 'fabled' | 'loric'>;

export function isSeatable(type: CharacterType): type is SeatableType {
	return type !== 'fabled' && type !== 'loric';
}

/**
 * The colour family a character type's headings and labels use: good and evil for the
 * seated types, purple for Travellers and green for Loric (Trevor, 2026-10-18). Fabled keep
 * the plain heading colour.
 */
export type TypeTone = 'good' | 'evil' | 'traveller' | 'loric';

export function typeTone(type: CharacterType): TypeTone | undefined {
	switch (type) {
		case 'traveller':
		case 'loric':
			return type;
		case 'fabled':
			return undefined;
		default:
			return defaultAlignment(type);
	}
}

/**
 * The alignment a character starts with, from its type: Townsfolk and Outsiders are good,
 * Minions and Demons are evil. Travellers have none (the Storyteller chooses when one is
 * assigned), and Fabled and Loric have none because they are not players' characters.
 * https://wiki.bloodontheclocktower.com/Character_Types
 */
export function defaultAlignment(type: CharacterType): Alignment | undefined {
	switch (type) {
		case 'townsfolk':
		case 'outsider':
			return 'good';
		case 'minion':
		case 'demon':
			return 'evil';
		case 'traveller':
		case 'fabled':
		case 'loric':
			return undefined;
	}
}

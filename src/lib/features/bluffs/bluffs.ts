import type { CharacterId } from '#lib/core/data/index.ts';
import { trueCharacter, type CharacterLookup, type Game } from '#lib/core/model/index.ts';

/**
 * Where bluff sets live in `game.bluffs`: the Demon's set first, which must not hold
 * characters in play. The Storyteller may add more sets (Trevor, 2026-10-16); the second is
 * the Lunatic's while a Lunatic is in play. Only the Demon's set is checked against play.
 */
export const DEMON_SET = 0;
export const LUNATIC_SET = 1;

/**
 * The characters really in play: each seat's true character, so the Townsfolk a Drunk or
 * Marionette believes they are is not in play, and neither is the Demon a Lunatic is shown
 * (https://wiki.bloodontheclocktower.com/Drunk, /Marionette, /Lunatic). The Demon's bluffs
 * are good characters not in play (https://wiki.bloodontheclocktower.com/Demon).
 */
export function charactersReallyInPlay(game: Game, characters: CharacterLookup): Set<CharacterId> {
	const ids = new Set<CharacterId>();
	for (const seatId of game.seating) {
		const id = trueCharacter(game, seatId, characters);
		if (id !== undefined) ids.add(id);
	}
	return ids;
}

export function lunaticInPlay(game: Game, characters: CharacterLookup): boolean {
	return charactersReallyInPlay(game, characters).has('lunatic');
}

/** The Demon's bluffs that are now in play (after a seat change), to be replaced. */
export function demonBluffsInPlay(game: Game, characters: CharacterLookup): CharacterId[] {
	const inPlay = charactersReallyInPlay(game, characters);
	return (game.bluffs[DEMON_SET] ?? []).filter((id) => inPlay.has(id));
}

/**
 * The name of a bluff set, by position: the Demon's first, then "Set 2" and on, except that
 * the second set is the Lunatic's while a Lunatic is in play.
 */
export function bluffSetLabel(index: number, lunatic: boolean): string {
	if (index === DEMON_SET) return 'Demon';
	if (index === LUNATIC_SET && lunatic) return 'Lunatic';
	return `Set ${index + 1}`;
}

/** A bluff set the Storyteller can show with "These characters are not in play". */
export interface ShowableBluffSet {
	set: number;
	label: string;
	characterIds: CharacterId[];
}

/**
 * The bluff sets in this game that have characters, in order (Trevor, 2026-10-16: any
 * number of sets). Empty sets are left out, so an empty list means none are chosen yet.
 */
export function showableBluffSets(game: Game, characters: CharacterLookup): ShowableBluffSet[] {
	const lunatic = lunaticInPlay(game, characters);
	return game.bluffs.flatMap((ids, set) =>
		ids.length > 0 ? [{ set, label: bluffSetLabel(set, lunatic), characterIds: [...ids] }] : []
	);
}

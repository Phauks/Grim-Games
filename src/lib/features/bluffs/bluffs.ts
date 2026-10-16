import type { CharacterId } from '#lib/core/data/index.ts';
import { trueCharacter, type CharacterLookup, type Game } from '#lib/core/model/index.ts';

/**
 * Where each bluff set lives in `game.bluffs` (Trevor, 2026-10-16): one set for the Demon,
 * and a second, optional set for the Lunatic, used only while a Lunatic is in play. Sets
 * after these come from older builds that allowed any number; they are kept but not shown.
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

/**
 * Wishes (a character's `wish` rule: the Wizard's, https://wiki.bloodontheclocktower.com/Wizard):
 * once per game its player makes a wish, which the Storyteller grants or declines; a granted
 * one may have a price and leave a clue, both the Storyteller's own words. Each wish is a
 * `wish` entry in the day log, so it stays in the game's history.
 *
 * A declined wish leaves the player free to wish again; a granted one ends the "may make a
 * wish" reminder (`when.noWish`). A granted wish may also carry a standard effect the app
 * acts on (`WISH_EFFECTS`): `good-drunk` makes every good player drunk for the rest of the
 * game (`abilityState`), so their information may be anything.
 *
 * The Storyteller decides everything here: nothing is refused, and the effect lasts until
 * they remove the wish from the log.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { DayEntry, Game, SeatId, WishEffect } from '#lib/core/model/types.ts';

export type Wish = Extract<DayEntry, { kind: 'wish' }>;

/** Every wish made this game, oldest first: earlier days, then today. */
export function wishes(game: Game): Wish[] {
	return [...game.pastDays, game.today].flatMap((day) =>
		day.entries.filter((e): e is Wish => e.kind === 'wish')
	);
}

/** The granted wish of this seat's player, if any. */
export function grantedWish(game: Game, seatId: SeatId): Wish | undefined {
	return wishes(game).find((w) => w.seatId === seatId && w.granted);
}

/** Seats whose player has had a wish granted. */
export function grantedWishSeats(game: Game): SeatId[] {
	return [...new Set(wishes(game).flatMap((w) => (w.granted ? [w.seatId] : [])))];
}

/** Whether a character makes a wish (its `wish` rule). */
export function makesWish(characterId: CharacterId | undefined, characters?: CharacterLookup) {
	return characterId !== undefined && rulesOf(characterId, characters)?.wish === true;
}

/** A granted wish whose effect is `effect`, the first one, if any. */
export function wishWithEffect(game: Game, effect: WishEffect): Wish | undefined {
	return wishes(game).find((w) => w.granted && w.effect === effect);
}

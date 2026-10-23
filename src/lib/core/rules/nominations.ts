/**
 * Nominations (https://wiki.bloodontheclocktower.com/Glossary, "Nomination"): who nominated
 * whom today, from the day log the engine keeps (`Nominate`, `EditNomination` and
 * `RemoveDayEntry` record them; the engine warns on a second nomination by or of a player, or
 * a dead nominator). Special rules that act on a nomination read them from here.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { NominatedEffect } from '#lib/core/data/character-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { DayEntry, Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState, registrations } from './ability.ts';

export type Nomination = Extract<DayEntry, { kind: 'nomination' }>;

/** Today's nominations, in the order they were made. */
export function todaysNominations(game: Game): Nomination[] {
	return game.today.entries.filter((e): e is Nomination => e.kind === 'nomination');
}

/** A seat's part in today's nominations: the one it made and the one it received, if any. */
export function seatNominations(
	game: Game,
	seatId: SeatId
): { made?: Nomination; received?: Nomination } {
	const today = todaysNominations(game);
	const made = today.find((n) => n.nominator === seatId);
	const received = today.find((n) => n.nominee === seatId);
	return { ...(made ? { made } : {}), ...(received ? { received } : {}) };
}

/** A character's ability a nomination sets off, for the board to offer (warn, never lock). */
export interface CharacterNominationPrompt {
	kind: NominatedEffect;
	/** The nominee's character, whose ability it is. */
	characterId: CharacterId;
	nominator: SeatId;
	nominee: SeatId;
}

/**
 * What a nomination sets off by the nominee's character (`onNominated` in its rules), only
 * while it can happen: the nominee's ability works and isn't spent (no "No Ability" reminder
 * of its own), and the nominator is, or might register as, the `by` type. For the Virgin
 * (https://wiki.bloodontheclocktower.com/Virgin) a Townsfolk nominator is executed
 * straight away. A Spy might register as a Townsfolk, so a Spy nominator is asked about too.
 */
export function characterNominationPrompts(
	game: Game,
	nomination: { nominator: SeatId; nominee: SeatId },
	characters: CharacterLookup
): CharacterNominationPrompt[] {
	const { nominator, nominee } = nomination;
	const characterId = trueCharacter(game, nominee, characters);
	if (characterId === undefined || nominator === nominee) return [];
	const rule = rulesOf(characterId, characters)?.onNominated;
	if (!rule || !abilityState(game, nominee, characters).works) return [];
	const spent = game.seats[nominee]?.reminders.some(
		(r) => r.characterId === characterId && r.label === 'No Ability'
	);
	if (spent) return [];
	const registersAs =
		typeOf(game, nominator, characters) === rule.by ||
		registrations(game, characters).some(
			(r) => r.seatId === nominator && r.types.includes(rule.by)
		);
	return registersAs ? [{ kind: rule.effect, characterId, nominator, nominee }] : [];
}

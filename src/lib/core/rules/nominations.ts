/**
 * Nominations (https://wiki.bloodontheclocktower.com/Glossary, "Nomination"): who nominated
 * whom today, from the day log the engine keeps (`Nominate`, `EditNomination` and
 * `RemoveDayEntry` record them; the engine warns on a second nomination by or of a player, or
 * a dead nominator). Special rules that act on a nomination read them from here.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { AfterDeath } from '#lib/core/data/after-death-rules.ts';
import type { NominatedEffect } from '#lib/core/data/character-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { registersAsDead, trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { DayEntry, Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState, registrations } from './ability.ts';

export type Nomination = Extract<DayEntry, { kind: 'nomination' }>;

/** Today's nominations, in the order they were made. */
export function todaysNominations(game: Game): Nomination[] {
	return game.today.entries.filter((e): e is Nomination => e.kind === 'nomination');
}

/**
 * A seat's part in today's nominations: the latest it made (`allMade` has every one, for a
 * player who may nominate more than once) and the latest it received, if any.
 */
export function seatNominations(
	game: Game,
	seatId: SeatId
): { made?: Nomination; received?: Nomination; allMade: Nomination[] } {
	const today = todaysNominations(game);
	const allMade = today.filter((n) => n.nominator === seatId);
	const made = allMade.at(-1);
	const received = today.findLast((n) => n.nominee === seatId);
	return { ...(made ? { made } : {}), ...(received ? { received } : {}), allMade };
}

/**
 * What a dead player's character still lets them do (`afterDeath`, the Banshee killed by the
 * Demon), or undefined: alive, no such rule, or a death of another cause. A death whose cause
 * was not recorded counts, so the Storyteller is still offered the choice.
 */
export function afterDeath(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): AfterDeath | undefined {
	if (!registersAsDead(game, seatId)) return undefined;
	const characterId = trueCharacter(game, seatId, characters);
	const rule = characterId === undefined ? undefined : rulesOf(characterId, characters)?.afterDeath;
	if (!rule) return undefined;
	const cause = game.seats[seatId]?.deathCause;
	if (cause === undefined || rule.cause.includes(cause)) return rule;
	return rule.cause.includes('demon') && characters.get(cause)?.type === 'demon' ? rule : undefined;
}

/**
 * How many nominations a player may make today (https://wiki.bloodontheclocktower.com/Glossary,
 * "Nomination"): one while alive, none once dead, unless their character says otherwise
 * (`afterDeath`).
 */
export function nominationsPerDay(game: Game, seatId: SeatId, characters: CharacterLookup): number {
	if (!registersAsDead(game, seatId)) return 1;
	return afterDeath(game, seatId, characters)?.nominations ?? 0;
}

/** Whether a player may nominate at all today (`nominationsPerDay`). */
export function mayNominate(game: Game, seatId: SeatId, characters: CharacterLookup): boolean {
	return nominationsPerDay(game, seatId, characters) > 0;
}

/**
 * Whether `nominator`'s next nomination today is an extra one their character allows after the
 * day's first execution (`nominationsAfterExecution`, the Butcher): the once-a-day limits don't
 * apply to it, for them or their nominee. Only while their ability works. `ignore` leaves out a
 * nomination being changed.
 */
export function extraNominationOpen(
	game: Game,
	nominator: SeatId,
	characters: CharacterLookup,
	ignore?: string
): boolean {
	const characterId = trueCharacter(game, nominator, characters);
	const extra =
		characterId === undefined
			? undefined
			: rulesOf(characterId, characters)?.nominationsAfterExecution;
	if (!extra || !abilityState(game, nominator, characters).works) return false;
	const entries = game.today.entries.filter((e) => e.entryId !== ignore);
	const first = entries.findIndex((e) => e.kind === 'execution');
	if (first < 0) return false;
	const since = entries
		.slice(first + 1)
		.filter((e) => e.kind === 'nomination' && e.nominator === nominator).length;
	return since < extra;
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

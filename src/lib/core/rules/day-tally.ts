/**
 * Today's counts the Storyteller keeps by hand (`dayTally` in a character's rules,
 * `data/parts/day-tally.ts`): how often the Yaggababble said its secret phrase aloud today
 * (https://wiki.bloodontheclocktower.com/Yaggababble). Each count of a `kills` tally lets its
 * ability kill one player, at any time that day or that night, the character being the death
 * cause. The count starts at none each day, since it lives in the day log (`DayLog.tallies`).
 *
 * The Storyteller decides who dies and when: going past the count warns, never locks.
 */
import type { DayTally } from '#lib/core/data/parts/day-tally.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { DayLog, Game, SeatId } from '#lib/core/model/types.ts';

export type { DayTally };

/** A character's `dayTally` rule, if it has one. */
export function dayTallyOf(
	characterId: CharacterId | undefined,
	characters?: CharacterLookup
): DayTally | undefined {
	return characterId === undefined ? undefined : rulesOf(characterId, characters)?.dayTally;
}

/** A day's count for `characterId`: 0 until the Storyteller sets one. */
export function tallyCount(day: DayLog, characterId: CharacterId): number {
	return day.tallies?.[characterId]?.count ?? 0;
}

/**
 * How many players a `kills` tally's ability may still kill, from the current day's count (in
 * the night after a day, that day's, since its log is still `today` until the next dawn):
 * - `count`: today's count;
 * - `died`: the players it killed since this day began who are still dead from it;
 * - `left`: how many more may die from it, by day or tonight;
 * - `over`: more died than the count allows (a warning for the Storyteller).
 */
export interface TallyKills {
	count: number;
	died: SeatId[];
	left: number;
	over: boolean;
}

export function tallyKills(
	game: Game,
	characterId: CharacterId,
	characters?: CharacterLookup
): TallyKills | undefined {
	if (!dayTallyOf(characterId, characters)?.kills) return undefined;
	const count = tallyCount(game.today, characterId);
	const died = (game.today.tallies?.[characterId]?.deaths ?? []).filter(
		(s) => game.seats[s]?.dead === true && game.seats[s]?.deathCause === characterId
	);
	return {
		count,
		died,
		left: Math.max(0, count - died.length),
		over: died.length > count
	};
}

/**
 * Whether a death by `cause` counts against a `kills` tally: the character whose tally it is,
 * when `cause` names one.
 */
export function tallyKiller(
	cause: string | undefined,
	characters?: CharacterLookup
): CharacterId | undefined {
	return cause !== undefined && dayTallyOf(cause, characters)?.kills ? cause : undefined;
}

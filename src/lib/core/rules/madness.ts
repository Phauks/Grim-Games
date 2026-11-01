/**
 * Breaking madness (https://wiki.bloodontheclocktower.com/Madness): a player a character's
 * ability made mad who the Storyteller judges broke it may be executed or die, by that
 * character's `madness` rule (`data/madness-rules.ts`). The day view offers it on the
 * madness reminder; the Storyteller decides, so nothing here happens on its own.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { MadnessBreaking } from '#lib/core/data/madness-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { getSeat, trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { hasAbilityOf } from './gained-abilities.ts';
import { todaysNominations } from './nominations.ts';

export interface MadnessOffer {
	/** The character whose madness it is; the cause of the execution or death. */
	characterId: CharacterId;
	/** The mad player. */
	seatId: SeatId;
	breaking: MadnessBreaking;
	/** With `death`: the living players who might die, the mad player first. */
	dies: SeatId[];
}

/**
 * What breaking `characterId`'s madness does to the player in `seatId`, or undefined when
 * that player is not mad by it: they carry its token; with `chosenBy: 'nominee'`, a nominee
 * chose them today (the Big Wig's speaker); or, for a rule with neither, they are that
 * character, or hold its ability, and it works (a drunk Mutant is not mad; a Hermit with the
 * Mutant's is).
 */
export function madnessOffer(
	game: Game,
	characterId: CharacterId,
	seatId: SeatId,
	characters: CharacterLookup
): MadnessOffer | undefined {
	const rule = rulesOf(characterId, characters)?.madness;
	const seat = getSeat(game, seatId);
	if (!rule || !seat) return undefined;
	const carrying = (label: string) =>
		game.seating.filter((id) =>
			game.seats[id].reminders.some((r) => r.characterId === characterId && r.label === label)
		);
	const mad = rule.token
		? carrying(rule.token).includes(seatId)
		: rule.chosenBy === 'nominee'
			? todaysNominations(game).some((n) => n.chosen === seatId)
			: hasAbilityOf(game, seatId, characterId, characters);
	if (!mad) return undefined;
	if (rule.breaking === 'execution')
		return { characterId, seatId, breaking: 'execution', dies: [] };
	const dies = [...new Set([seatId, ...(rule.alsoDies ? carrying(rule.alsoDies) : [])])].filter(
		(id) => !game.seats[id].dead
	);
	return dies.length ? { characterId, seatId, breaking: 'death', dies } : undefined;
}

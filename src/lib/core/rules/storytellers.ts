/**
 * Two Storytellers (a rule character's `twoStorytellers` rule: the Knaves,
 * https://wiki.bloodontheclocktower.com/Knaves): one gives true information from character
 * abilities, the other false, and once per game they may switch. Each player picks which one
 * gives them their information, recorded for today (`DayLog.visits`).
 *
 * - The lying one's information must be false (`reliability`'s `mustBeFalse`), unless the
 *   player is drunk or poisoned, when either may say anything.
 * - The truthful one's is the ability's normal information; for a Savant both statements
 *   may be true (the wiki's example).
 * - Game rules and non-ability information (Minion info, bluffs, nominations) are never
 *   affected.
 *
 * A suggestion: the Storyteller can show anything, with a warning.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game, SeatId, StorytellerPair } from '#lib/core/model/types.ts';

/** The rule character in play that makes two Storytellers, if any. */
export function twoStorytellersBy(
	game: Game,
	characters?: CharacterLookup
): CharacterId | undefined {
	return game.ruleCharacters.find((id) => rulesOf(id, characters)?.twoStorytellers === true);
}

/** Which Storyteller a player went to today, and whether that one lies now. */
export interface StorytellerVisit {
	/** 0 or 1: the Storyteller's place in `Game.storytellerPair`. */
	storyteller: 0 | 1;
	/** Whether they lie; absent while the Storyteller hasn't said which one lies. */
	lies?: boolean;
	/** The rule character that makes two Storytellers. */
	by: CharacterId;
}

/** The player's visit today, while two Storytellers are in play. */
export function storytellerVisit(
	game: Game,
	seatId: SeatId,
	characters?: CharacterLookup
): StorytellerVisit | undefined {
	const by = twoStorytellersBy(game, characters);
	const storyteller = game.today.visits?.[seatId];
	if (!by || storyteller === undefined) return undefined;
	const liar = game.storytellerPair?.liar;
	return { storyteller, by, ...(liar !== undefined ? { lies: liar === storyteller } : {}) };
}

/** A Storyteller's name, or undefined when they have none (the UI says "Storyteller 1"). */
export function storytellerName(
	pair: StorytellerPair | undefined,
	storyteller: 0 | 1
): string | undefined {
	return pair?.names?.[storyteller]?.trim() || undefined;
}

/** The pair after switching: the liar tells the truth and the other lies. */
export function switchedPair(pair: StorytellerPair | undefined): StorytellerPair {
	const liar = pair?.liar === undefined ? undefined : pair.liar === 0 ? 1 : 0;
	return {
		...(pair?.names ? { names: pair.names } : {}),
		...(liar !== undefined ? { liar } : {}),
		switched: true
	};
}

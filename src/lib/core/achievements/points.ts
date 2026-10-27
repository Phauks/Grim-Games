/**
 * Points (Trevor, 2026-10-27): every game earns points, so playing a character again still
 * counts, and points buy laurel options. Points come from taking part only, the same for a
 * win or a loss (Trevor chose "Taking part only", 2026-10-27): no rule here can read who won
 * or what a seat did. Bonuses can reward a first game as a character, or facts about the game.
 *
 * Like achievements, the balance is worked out from the records each time; only purchases are
 * kept.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import { charactersOf, factsHold } from './engine.ts';
import type { GameFacts, LaurelOption, TakenPart } from './types.ts';

export type PointRule =
	/** Every game taken part in, optionally only those where the facts held. */
	| { id: string; points: number; kind: 'perGame'; where?: GameFacts }
	/** A game as a character this player had never played before. */
	| { id: string; points: number; kind: 'newCharacter' };

export interface PointsEntry {
	ruleId: string;
	gameId: string;
	points: number;
}

/** A laurel option bought with points. */
export interface Purchase {
	unlock: LaurelOption;
	cost: number;
}

/** Points from each game, in the order the games ended. */
export function pointsEarned(
	rules: readonly PointRule[],
	games: readonly TakenPart[]
): PointsEntry[] {
	const played = new Set<CharacterId>();
	const entries: PointsEntry[] = [];
	for (const game of [...games].sort((a, b) => a.record.endedAt - b.record.endedAt)) {
		const characters = charactersOf(game);
		for (const rule of rules) {
			const applies =
				rule.kind === 'perGame'
					? rule.where === undefined || factsHold(rule.where, game)
					: characters.some((id) => !played.has(id));
			if (applies)
				entries.push({ ruleId: rule.id, gameId: game.record.gameId, points: rule.points });
		}
		for (const id of characters) played.add(id);
	}
	return entries;
}

/** Points left to spend: everything earned less everything bought. */
export function balance(entries: readonly PointsEntry[], purchases: readonly Purchase[]): number {
	const earnedPoints = entries.reduce((sum, entry) => sum + entry.points, 0);
	return earnedPoints - purchases.reduce((sum, purchase) => sum + purchase.cost, 0);
}

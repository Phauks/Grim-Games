/**
 * Works out what a person has earned from the games they took part in. Nothing is stored:
 * like History's stats, it is worked out again from the records each time, so a changed or
 * new achievement also counts games played before it existed.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import { playerCount } from '#lib/core/stats/index.ts';
import type { Achievement, Criteria, Earned, GameFacts, LaurelOption, TakenPart } from './types.ts';

/** The characters a seat had: at the first Dawn and at the end. */
export function charactersOf(game: TakenPart): CharacterId[] {
	if (game.seatId === undefined) return [];
	const seat = game.record.seats.find((s) => s.seatId === game.seatId);
	const ids = [seat?.start?.characterId, seat?.end?.characterId];
	return [...new Set(ids.filter((id) => id !== undefined))];
}

/** True when every fact given holds for the game. */
export function factsHold(facts: GameFacts, game: TakenPart): boolean {
	const r = game.record;
	if (facts.ruleCharacter !== undefined && !r.ruleCharacters.includes(facts.ruleCharacter)) {
		return false;
	}
	if (facts.characterInPlay !== undefined) {
		const id = facts.characterInPlay;
		const inPlay = r.seats.some((s) => s.start?.characterId === id || s.end?.characterId === id);
		if (!inPlay) return false;
	}
	if (facts.endReason !== undefined && r.endReason !== facts.endReason) return false;
	if (facts.finalThree && !r.finalThree) return false;
	if (facts.minPlayers !== undefined && playerCount(r) < facts.minPlayers) return false;
	if (facts.minDays !== undefined && r.days < facts.minDays) return false;
	return true;
}

const asPlayer = (game: TakenPart) => game.seatId !== undefined;

/** Whether one game counts towards the criteria. */
function counts(criteria: Criteria, game: TakenPart): boolean {
	switch (criteria.kind) {
		case 'playedAs':
			return charactersOf(game).includes(criteria.character);
		case 'inGame':
			return asPlayer(game) && factsHold(criteria.where, game);
		case 'gamesPlayed': {
			if (criteria.as === 'player' && !asPlayer(game)) return false;
			if (criteria.as === 'storyteller' && asPlayer(game)) return false;
			return criteria.where === undefined || factsHold(criteria.where, game);
		}
	}
}

/** How many matching games the criteria need. */
const needed = (criteria: Criteria) => (criteria.kind === 'gamesPlayed' ? criteria.count : 1);

/** Games in the order they ended. */
const byEnd = (games: readonly TakenPart[]) =>
	[...games].sort((a, b) => a.record.endedAt - b.record.endedAt);

/** Progress towards one achievement: matching games so far, out of those it needs. */
export function progress(
	achievement: Achievement,
	games: readonly TakenPart[]
): { have: number; need: number } {
	const need = needed(achievement.criteria);
	const have = games.filter((game) => counts(achievement.criteria, game)).length;
	return { have: Math.min(have, need), need };
}

/**
 * The achievements earned, each dated by the end of the game that completed it, in the order
 * they were given.
 */
export function earned(
	achievements: readonly Achievement[],
	games: readonly TakenPart[]
): Earned[] {
	const ordered = byEnd(games);
	return achievements.flatMap((achievement) => {
		const matching = ordered.filter((game) => counts(achievement.criteria, game));
		const completing = matching[needed(achievement.criteria) - 1];
		return completing ? [{ id: achievement.id, earnedAt: completing.record.endedAt }] : [];
	});
}

/** Every laurel option the earned achievements unlock, each once. */
export function unlockedOptions(
	achievements: readonly Achievement[],
	earnedList: readonly Earned[]
): LaurelOption[] {
	const ids = new Set(earnedList.map((e) => e.id));
	const seen = new Set<string>();
	return achievements
		.filter((achievement) => ids.has(achievement.id))
		.flatMap((achievement) => achievement.unlocks)
		.filter((unlock) => {
			const key = `${unlock.part}:${unlock.option}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
}

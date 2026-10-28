/**
 * Works out what a person has earned from the games they took part in. Nothing is stored:
 * like History's stats, it is worked out again from the records each time, so a changed or
 * new achievement also counts games played before it existed.
 */
import type { CharacterId, CharacterType } from '#lib/core/data/index.ts';
import { playerCount, type RecordCharacter } from '#lib/core/stats/index.ts';
import type { Achievement, Criteria, Earned, GameFacts, LaurelOption, TakenPart } from './types.ts';

/**
 * Everything the player's seat had during the game, each once: a character or alignment it
 * was changed to counts as much as the one it started with (Trevor, 2026-10-27).
 */
function heldBy(game: TakenPart): RecordCharacter[] {
	if (game.seatId === undefined) return [];
	const seat = game.record.seats.find((s) => s.seatId === game.seatId);
	if (!seat) return [];
	return [seat.start, ...(seat.held ?? []), seat.end].filter((c) => c !== undefined);
}

/** The characters the player's seat had during the game. */
export function charactersOf(game: TakenPart): CharacterId[] {
	return [...new Set(heldBy(game).map((c) => c.characterId))];
}

/** The character types the player's seat had during the game. */
export function typesOf(game: TakenPart): CharacterType[] {
	const types = charactersOf(game).map((id) => game.record.characters[id]?.type);
	return [...new Set(types.filter((t) => t !== undefined))];
}

/** Whether the player's team at the end was the team that won. */
export function wonGame(game: TakenPart): boolean {
	const seat = game.record.seats.find((s) => s.seatId === game.seatId);
	const team = seat?.end?.alignment;
	return team !== undefined && team === game.record.winner;
}

/** Whether the player's seat changed character, or alignment, during the game. */
function changed(game: TakenPart, what: 'character' | 'alignment'): boolean {
	const values = heldBy(game).map((c) => (what === 'character' ? c.characterId : c.alignment));
	return new Set(values.filter((v) => v !== undefined)).size > 1;
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
		case 'playedType':
			return typesOf(game).includes(criteria.type) && (!criteria.won || wonGame(game));
		case 'changed':
			return changed(game, criteria.what);
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

/**
 * Shared helpers for the game end rules (`game-end.ts`): day logs, the
 * players whose rules have an end or hold of a kind, and who is alive for the game's end.
 */
import type { EndKind, GameEndRules, HoldKind } from '#lib/core/data/game-end-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { Alignment, CharacterId } from '#lib/core/data/types.ts';
import { wikiUrl } from '#lib/core/data/wiki.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import {
	alignmentOf,
	isAliveForWin,
	isTraveller,
	trueCharacter,
	typeOf
} from '#lib/core/model/selectors.ts';
import type { DayLog, Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState } from './ability.ts';
import { carriesDemonToken } from './death-causes.ts';
import type { GameEndOptions, GameHold } from './game-end.ts';

export const W = 'https://wiki.bloodontheclocktower.com/';

export const other = (team: Alignment): Alignment => (team === 'good' ? 'evil' : 'good');

/** The team that wins when this player's team loses. */
export function losesFor(game: Game, seatId: SeatId): Alignment {
	return other(alignmentOf(game, seatId) ?? 'good');
}

/** Every day log, oldest first: index 0 is before the first Dawn, then day 1, day 2... */
export function days(game: Game): DayLog[] {
	return [...game.pastDays, game.today];
}

export function executedOn(log: DayLog): SeatId[] {
	return log.entries.flatMap((e) => (e.kind === 'execution' ? [e.seatId] : []));
}

function gameEndRules(characterId: CharacterId | undefined, characters: CharacterLookup) {
	return characterId ? rulesOf(characterId, characters)?.gameEnd : undefined;
}

/** A player whose true character has a rule, with the rule. */
export interface Ruled<T> {
	seatId: SeatId;
	characterId: CharacterId;
	rule: T;
}

/** Every player whose true character's `gameEnd` has a rule `pick` finds, in seating order. */
export function ruled<T>(
	game: Game,
	characters: CharacterLookup,
	pick: (rules: GameEndRules) => readonly T[] | undefined
): Ruled<T>[] {
	return game.seating.flatMap((seatId) => {
		const characterId = trueCharacter(game, seatId, characters);
		const rules = gameEndRules(characterId, characters);
		return characterId && rules
			? (pick(rules) ?? []).map((rule) => ({ seatId, characterId, rule }))
			: [];
	});
}

export function endsOf<K extends EndKind>(game: Game, characters: CharacterLookup, kind: K) {
	return ruled(game, characters, (r) => r.ends?.filter((e) => e.kind === kind));
}

export function holdsOf<K extends HoldKind>(game: Game, characters: CharacterLookup, kind: K) {
	return ruled(game, characters, (r) => r.holds?.filter((h) => h.kind === kind));
}

/** The character's wiki page, or the Glossary for a homebrew character. */
export function wikiOf(characterId: CharacterId, characters: CharacterLookup): string {
	const character = characters.get(characterId);
	return (character && wikiUrl(character)) ?? `${W}Glossary`;
}

/** The players carrying a character's reminder. */
export function carrying(game: Game, characterId: CharacterId, label: string): SeatId[] {
	return game.seating.filter((id) =>
		game.seats[id].reminders.some((r) => r.characterId === characterId && r.label === label)
	);
}

/** Abilities stop working when drunk or poisoned; `holds` says so rather than deciding. */
export function impaired(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): GameHold[] {
	return abilityState(game, seatId, characters).impairments.length > 0
		? [{ rule: 'impaired', characterId, seats: [seatId], wiki: `${W}Glossary` }]
		: [];
}

/**
 * Alive for the game's end. Marked dead isn't always dead, while sober (`aliveWhileDead`):
 * - until its own token marks the real death: the Zombuul's first death, when it lives but
 *   registers as dead (https://wiki.bloodontheclocktower.com/Zombuul);
 * - while the player with its token lives: the Lleech dies only with its host
 *   (https://wiki.bloodontheclocktower.com/Lleech).
 */
/**
 * Marked dead, yet still alive by its own ability (`gameEnd.aliveWhileDead`): the Zombuul after
 * its first death, which "lives but registers as dead" and still wakes to kill
 * (https://wiki.bloodontheclocktower.com/Zombuul), or a Lleech whose host lives
 * (https://wiki.bloodontheclocktower.com/Lleech). Such a player keeps their night step.
 */
export function livesWhileDead(game: Game, seatId: SeatId, characters: CharacterLookup): boolean {
	return !!game.seats[seatId]?.dead && aliveForEnd(game, seatId, characters);
}

export function aliveForEnd(game: Game, seatId: SeatId, characters: CharacterLookup): boolean {
	if (isAliveForWin(game, seatId)) return true;
	const seat = game.seats[seatId];
	if (!seat) return false;
	const characterId = trueCharacter(game, seatId, characters);
	const rule = gameEndRules(characterId, characters)?.aliveWhileDead;
	if (!characterId || !rule) return false;
	if (abilityState(game, seatId, characters).impairments.length > 0) return false;
	if (
		rule.untilToken &&
		seat.reminders.some((r) => r.characterId === characterId && r.label === rule.untilToken)
	) {
		return false;
	}
	if (
		rule.whileCarrierAlive &&
		!carrying(game, characterId, rule.whileCarrierAlive).some((id) => isAliveForWin(game, id))
	) {
		return false;
	}
	return true;
}

/** The Demons: by true character, or a reminder that makes them the Demon. */
export function demonSeats(game: Game, characters: CharacterLookup): SeatId[] {
	return game.seating.filter(
		(id) => typeOf(game, id, characters) === 'demon' || carriesDemonToken(game, id, characters)
	);
}

/** Players alive for the "just 2 alive" rule: Travellers don't count. */
export function aliveNonTravellers(game: Game, characters: CharacterLookup): SeatId[] {
	return game.seating.filter(
		(id) => aliveForEnd(game, id, characters) && !isTraveller(game, id, characters)
	);
}

/**
 * Days that are over, by index: every day closed by Dawn, and today when `dayEnded`.
 * Index 0 (before the first Dawn) is not a day.
 */
export function endedDays(game: Game, options: GameEndOptions): number[] {
	const last = game.pastDays.length;
	const out: number[] = [];
	for (let day = 1; day < last; day++) out.push(day);
	if (options.dayEnded && last >= 1) out.push(last);
	return out;
}

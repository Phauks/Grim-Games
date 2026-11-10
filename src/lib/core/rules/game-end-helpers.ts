/**
 * Shared helpers for the game end rules (`game-end.ts`): day logs, the
 * players whose rules have an end or hold of a kind, and who is alive for the game's end.
 */
import type {
	EndEvent,
	EndKind,
	EndsGame,
	GameEndRules,
	HoldThen
} from '#lib/core/data/game-end-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { Alignment, CharacterId, CharacterType } from '#lib/core/data/types.ts';
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
import type { GameEnd, GameEndOptions, GameHold } from './game-end.ts';

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

/** Every player whose true character has a `condition` end on `event`, with the rule. */
export function eventsOf(game: Game, characters: CharacterLookup, event: EndEvent) {
	return ruled(game, characters, (r) =>
		r.ends?.filter((e) => e.kind === 'condition' && e.event === event)
	);
}

/** The name an end is shown under: the official kind it was written as, else `condition`. */
export const endName = (rule: EndsGame): EndKind => rule.preset ?? 'condition';

/**
 * Who a condition says wins: its `winner`; else `own` (its player's team), `other` (the team
 * its player is not on) or `opposing` (the team `subject` is not on).
 */
export function winnerFor(game: Game, seatId: SeatId, rule: EndsGame, subject?: SeatId): Alignment {
	if (rule.winner) return rule.winner;
	if (rule.wins === 'other') return losesFor(game, seatId);
	if (rule.wins === 'opposing' && subject !== undefined) return losesFor(game, subject);
	return alignmentOf(game, seatId) ?? 'good';
}

/** Every player whose true character has a hold that may lead to `then`, with the hold. */
export function holdsOf(game: Game, characters: CharacterLookup, then: HoldThen) {
	return ruled(game, characters, (r) => r.holds?.filter((h) => h.then === then));
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
 * Marked dead, yet still alive by its own ability (`gameEnd.aliveWhileDead`): the Zombuul after
 * its first death, which "lives but registers as dead" and still wakes to kill
 * (https://wiki.bloodontheclocktower.com/Zombuul), or a Lleech whose host lives
 * (https://wiki.bloodontheclocktower.com/Lleech). Such a player keeps their night step.
 */
export function livesWhileDead(game: Game, seatId: SeatId, characters: CharacterLookup): boolean {
	return !!game.seats[seatId]?.dead && aliveForEnd(game, seatId, characters);
}

/**
 * Alive for the game's end. Marked dead isn't always dead, while sober (`aliveWhileDead`):
 * the Zombuul's first death, a Lleech whose host lives.
 */
export function aliveForEnd(game: Game, seatId: SeatId, characters: CharacterLookup): boolean {
	if (isAliveForWin(game, seatId)) return !diesWithCarrier(game, seatId, characters);
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

/** Whether a player is `on`: an alignment, or a character type by true character. */
export function isOn(
	game: Game,
	seatId: SeatId,
	on: Alignment | CharacterType,
	characters: CharacterLookup
): boolean {
	return on === 'good' || on === 'evil'
		? alignmentOf(game, seatId) === on
		: typeOf(game, seatId, characters) === on;
}

/**
 * Its player's logged guesses (a note with guesses) name every Demon as a Demon and every
 * Minion as a Minion, dead ones too, and nobody else; a guessed character counts by its type
 * (the Alsaahir: https://wiki.bloodontheclocktower.com/Alsaahir).
 */
export function guessesEvilTeam(game: Game, characters: CharacterLookup): GameEnd[] {
	const rightGuess = (id: SeatId, guess: CharacterId | undefined) =>
		guess !== undefined && characters.get(guess)?.type === typeOf(game, id, characters);
	const out: GameEnd[] = [];
	for (const { seatId, characterId, rule } of eventsOf(game, characters, 'guessed')) {
		const team = game.seating.filter((id) => {
			const type = typeOf(game, id, characters);
			return type !== undefined && (rule.types?.includes(type) ?? false);
		});
		if (team.length === 0) continue;
		const right = days(game)
			.flatMap((log) => log.entries)
			.find((entry) => {
				if (entry.kind !== 'note' || entry.characterId !== characterId) return false;
				if (entry.seatId !== seatId || !entry.guesses?.length) return false;
				const guessed = new Map(entry.guesses.map((g) => [g.seatId, g.characterId]));
				return guessed.size === team.length && team.every((id) => rightGuess(id, guessed.get(id)));
			});
		if (!right) continue;
		out.push({
			key: `${endName(rule)}:${right.entryId}`,
			rule: endName(rule),
			winner: winnerFor(game, seatId, rule),
			characterId,
			seats: [seatId, ...team],
			wiki: wikiOf(characterId, characters),
			holds: impaired(game, seatId, characterId, characters)
		});
	}
	return out;
}

/**
 * A living player whose ability says they die once every player carrying its
 * `aliveWhileDead.whileCarrierAlive` token is dead, and it is: the Lleech dies with its host
 * though the Storyteller has not marked it yet, so good wins at once
 * (https://wiki.bloodontheclocktower.com/Lleech, M15h). Only while sober: a drunk or poisoned
 * Lleech lives on. With no token on anyone (no host chosen yet) it lives.
 */
function diesWithCarrier(game: Game, seatId: SeatId, characters: CharacterLookup): boolean {
	const characterId = trueCharacter(game, seatId, characters);
	const token = gameEndRules(characterId, characters)?.aliveWhileDead?.whileCarrierAlive;
	if (!characterId || !token) return false;
	const carriers = carrying(game, characterId, token).filter((id) => id !== seatId);
	if (carriers.length === 0 || carriers.some((id) => isAliveForWin(game, id))) return false;
	return abilityState(game, seatId, characters).works;
}

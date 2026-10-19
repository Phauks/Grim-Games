/**
 * Works out a finished game's record from its saved event log (Trevor, 2026-10-16). The log
 * holds everything, so games ended before records existed get one too, and reopening and
 * editing a game changes its record.
 */
import type { Alignment, CharacterId, GameData } from '#lib/core/data/index.ts';
import { applyEvent, type SavedGame } from '#lib/core/engine/index.ts';
import {
	alignmentOf,
	characterLookup,
	isAliveForWin,
	isTraveller,
	trueCharacter,
	type CharacterLookup,
	type DayLog,
	type Game,
	type SeatId
} from '#lib/core/model/index.ts';
import { detectedEndReason, type EndReason } from '#lib/core/rules/end-reason.ts';
import {
	GAME_RECORD_VERSION,
	type GameRecord,
	type RecordCharacter,
	type RecordDay,
	type RecordRole
} from './record.ts';

/** What ending the game recorded on this device (`endedGames` in the grimoire). */
export interface GameEnding {
	endedAt: number;
	winner?: Alignment;
	/** How it was won, as End game saved it; games ended before it was asked have none. */
	reason?: EndReason;
}

function snapshot(game: Game, characters: CharacterLookup): Map<SeatId, RecordCharacter> {
	const out = new Map<SeatId, RecordCharacter>();
	for (const seatId of game.seating) {
		const characterId = trueCharacter(game, seatId, characters);
		if (characterId === undefined) continue;
		const alignment = alignmentOf(game, seatId);
		out.set(seatId, alignment ? { characterId, alignment } : { characterId });
	}
	return out;
}

function aliveCount(game: Game, characters: CharacterLookup): number {
	return game.seating.filter((id) => isAliveForWin(game, id) && !isTraveller(game, id, characters))
		.length;
}

function recordDay(log: DayLog, day: number): RecordDay {
	const record: RecordDay = { day, nominations: 0, executed: [], exiled: [] };
	for (const entry of log.entries) {
		if (entry.kind === 'nomination') record.nominations++;
		else if (entry.kind === 'execution') record.executed.push(entry.seatId);
		else if (entry.kind === 'exile') record.exiled.push(entry.seatId);
	}
	return record;
}

/**
 * The record of a game saved on this device. Starting characters are taken at the first
 * Dawn (or at the end, if the game ended during the first night), and use the player's true
 * character, so the Drunk counts as the Drunk (`trueCharacter`).
 */
export function deriveGameRecord(
	saved: SavedGame,
	ending: GameEnding,
	data: Pick<GameData, 'characters'>,
	role: RecordRole = 'storyteller'
): GameRecord {
	let game: Game | undefined;
	let start: Map<SeatId, RecordCharacter> | undefined;
	const diedOnDay = new Map<SeatId, number>();
	let finalThree = false;
	let lookup: { script: Game['script']; characters: CharacterLookup } | undefined;
	const charactersOf = (g: Game) => {
		if (lookup?.script !== g.script)
			lookup = { script: g.script, characters: characterLookup(data, g.script) };
		return lookup.characters;
	};
	for (const entry of saved.log.entries.slice(0, saved.log.cursor)) {
		for (const event of entry.events) {
			if (event.type === 'DayStarted' && game && !start) {
				start = snapshot(game, characterLookup(data, game.script));
			}
			game = applyEvent(game, event);
			if (event.type === 'DeathSet') {
				if (event.dead) diedOnDay.set(event.seatId, game.pastDays.length);
				else diedOnDay.delete(event.seatId);
			}
		}
		// After each step, so deaths in one step (a night's kills) count together.
		if (game && start && !finalThree) {
			finalThree = aliveCount(game, charactersOf(game)) === 3;
		}
	}
	if (!game) throw new Error('the log has no GameCreated entry');

	const characters = characterLookup(data, game.script);
	const end = snapshot(game, characters);
	start ??= end;

	const mentioned = new Set<CharacterId>(game.ruleCharacters);
	for (const c of [...start.values(), ...end.values()]) mentioned.add(c.characterId);
	const named: GameRecord['characters'] = {};
	for (const id of mentioned) {
		const character = characters.get(id);
		if (character) named[id] = { name: character.name, type: character.type };
	}

	const days = game.pastDays.length;
	const record: GameRecord = {
		recordVersion: GAME_RECORD_VERSION,
		gameId: game.gameId,
		role,
		createdAt: game.createdAt,
		endedAt: ending.endedAt,
		script: {},
		finalThree,
		days,
		seats: game.seating.map((seatId) => {
			const seat = game.seats[seatId];
			return {
				seatId,
				...(seat.playerName ? { playerName: seat.playerName } : {}),
				...(start.has(seatId) ? { start: start.get(seatId) } : {}),
				...(end.has(seatId) ? { end: end.get(seatId) } : {}),
				dead: seat.dead,
				...(seat.dead && seat.deathCause ? { deathCause: seat.deathCause } : {}),
				...(seat.dead && diedOnDay.has(seatId) ? { diedOnDay: diedOnDay.get(seatId) } : {})
			};
		}),
		ruleCharacters: [...game.ruleCharacters],
		dayLog: [...game.pastDays, game.today].map((log, day) => recordDay(log, day)),
		characters: named
	};
	if (game.script.meta?.name) record.script.name = game.script.meta.name;
	if (game.script.meta?.author) record.script.author = game.script.meta.author;
	if (ending.winner) {
		record.winner = ending.winner;
		record.endReason = ending.reason ?? detectedEndReason(game, characters, ending.winner);
	}
	return record;
}

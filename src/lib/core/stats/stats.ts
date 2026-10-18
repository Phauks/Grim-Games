/**
 * Stats over game records, for History (Trevor, 2026-10-16). Pure: History's tables sort and
 * filter what these return.
 *
 * - A game is *decided* when its winning team was recorded; win rates count decided games only.
 * - A character's games are those a player started as it (their true character at the first
 *   Dawn); it won when that player's team at the end was the winning team.
 * - Players are matched by name, ignoring case and surrounding spaces.
 * - Player counts leave out Travellers, as the setup table does
 *   (https://wiki.bloodontheclocktower.com/Traveller).
 */
import type { Alignment, CharacterId, CharacterName, CharacterType } from '#lib/core/data/index.ts';
import type { GameRecord, RecordEndRule, RecordSeat } from './record.ts';

export interface TeamCounts {
	good: number;
	evil: number;
}

export interface Summary {
	games: number;
	/** Games won by each team; the rest had no winner recorded. */
	wins: TeamCounts;
	/** Decided games won some other way than the usual ends (`RecordEndRule`). */
	alternateWins: number;
	/** Games that reached the final 3, and the winners of those that were decided. */
	finalThree: { games: number; wins: TeamCounts };
	/** Undefined with no games. */
	averageDays?: number;
	averagePlayers?: number;
}

export interface ScriptStats {
	/** The script's name and author, which together tell scripts apart. */
	key: string;
	name?: string;
	author?: string;
	games: number;
	wins: TeamCounts;
	lastPlayed: number;
}

export interface CharacterStats {
	characterId: CharacterId;
	name: CharacterName;
	type: CharacterType;
	games: number;
	decided: number;
	wins: number;
}

export interface PlayerStats {
	/** The name as first written, most recent game first. */
	name: string;
	games: number;
	/** Games they ended on each team. */
	teams: TeamCounts;
	decided: number;
	wins: number;
	deaths: number;
}

export interface HistoryStats {
	summary: Summary;
	scripts: ScriptStats[];
	characters: CharacterStats[];
	players: PlayerStats[];
}

const isTraveller = (record: GameRecord, seat: RecordSeat): boolean => {
	const id = (seat.start ?? seat.end)?.characterId;
	return id !== undefined && record.characters[id]?.type === 'traveller';
};

/** Players in the game, not counting Travellers. */
export function playerCount(record: GameRecord): number {
	return record.seats.filter((seat) => !isTraveller(record, seat)).length;
}

/** The usual ends; every other end rule (or the Storyteller's call) is an alternate win. */
export const isAlternateWin = (rule: RecordEndRule | undefined): boolean =>
	rule !== undefined && rule !== 'demon-dead' && rule !== 'two-alive';

const average = (values: number[]): number | undefined =>
	values.length === 0 ? undefined : values.reduce((a, b) => a + b, 0) / values.length;

const won = (record: GameRecord, alignment: Alignment | undefined): boolean =>
	record.winner !== undefined && alignment === record.winner;

export const scriptKey = (script: GameRecord['script']): string =>
	`${script.name ?? ''}\u0000${script.author ?? ''}`;

const playerKey = (name: string): string => name.trim().toLocaleLowerCase();

/** Stats over `records`, most recent first where order matters. */
export function historyStats(records: readonly GameRecord[]): HistoryStats {
	const sorted = [...records].sort((a, b) => b.endedAt - a.endedAt);
	const wins: TeamCounts = { good: 0, evil: 0 };
	let alternateWins = 0;
	const finalThree = { games: 0, wins: { good: 0, evil: 0 } };
	const scripts = new Map<string, ScriptStats>();
	const characters = new Map<CharacterId, CharacterStats>();
	const players = new Map<string, PlayerStats>();

	for (const record of sorted) {
		if (record.winner) wins[record.winner]++;
		if (record.winner && isAlternateWin(record.endRule)) alternateWins++;
		if (record.finalThree) {
			finalThree.games++;
			if (record.winner) finalThree.wins[record.winner]++;
		}

		const key = scriptKey(record.script);
		let script = scripts.get(key);
		if (!script) {
			script = { key, games: 0, wins: { good: 0, evil: 0 }, lastPlayed: record.endedAt };
			if (record.script.name) script.name = record.script.name;
			if (record.script.author) script.author = record.script.author;
			scripts.set(key, script);
		}
		script.games++;
		if (record.winner) script.wins[record.winner]++;

		for (const seat of record.seats) {
			const team = seat.end?.alignment ?? seat.start?.alignment;
			if (seat.start) {
				const id = seat.start.characterId;
				const known = record.characters[id];
				let character = characters.get(id);
				if (!character) {
					character = {
						characterId: id,
						name: known?.name ?? (id as CharacterName),
						type: known?.type ?? 'townsfolk',
						games: 0,
						decided: 0,
						wins: 0
					};
					characters.set(id, character);
				}
				character.games++;
				if (record.winner) character.decided++;
				if (won(record, team)) character.wins++;
			}

			const name = seat.playerName?.trim();
			if (!name) continue;
			let player = players.get(playerKey(name));
			if (!player) {
				player = { name, games: 0, teams: { good: 0, evil: 0 }, decided: 0, wins: 0, deaths: 0 };
				players.set(playerKey(name), player);
			}
			player.games++;
			if (team) player.teams[team]++;
			if (record.winner && team) player.decided++;
			if (won(record, team)) player.wins++;
			if (seat.dead) player.deaths++;
		}
	}

	return {
		summary: {
			games: sorted.length,
			wins,
			alternateWins,
			finalThree,
			averageDays: average(sorted.map((r) => r.days)),
			averagePlayers: average(sorted.map(playerCount))
		},
		scripts: [...scripts.values()],
		characters: [...characters.values()],
		players: [...players.values()]
	};
}

/** A win rate from 0 to 1; undefined when nothing was decided. */
export function winRate(wins: number, decided: number): number | undefined {
	return decided === 0 ? undefined : wins / decided;
}

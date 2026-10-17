/**
 * Game records and History stats. Rules sources:
 * - https://wiki.bloodontheclocktower.com/Drunk (the Drunk thinks they are a Townsfolk, so the
 *   record counts their true character)
 * - https://wiki.bloodontheclocktower.com/Scarlet_Woman (becomes the Demon mid-game, so starting
 *   and final characters differ)
 * - https://wiki.bloodontheclocktower.com/Traveller (Travellers are not counted as players)
 */
import { describe, expect, it } from 'vitest';
import type { CharacterName } from '#lib/core/data/index.ts';
import { toSavedGame } from '#lib/core/engine/index.ts';
import { gameData, newGame, run } from '#lib/core/model/fixtures.test-support.ts';
import { deriveGameRecord } from './derive.ts';
import type { GameRecord } from './record.ts';
import { historyStats, playerCount, winRate } from './stats.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve', 'Fay'];

function playedGame() {
	const { session, ctx, seats } = newGame(names);
	const [ana, ben, cat, dev, eve, fay] = seats;
	const s = run(
		session,
		ctx,
		{ type: 'AssignCharacter', seatId: ana, characterId: 'imp' },
		{ type: 'AssignCharacter', seatId: ben, characterId: 'scarletwoman' },
		{ type: 'AssignCharacter', seatId: cat, characterId: 'chef' },
		{ type: 'AddReminder', seatId: cat, reminder: { characterId: 'drunk', label: 'Is The Drunk' } },
		{ type: 'AssignCharacter', seatId: dev, characterId: 'slayer' },
		{ type: 'AssignCharacter', seatId: eve, characterId: 'empath' },
		{ type: 'AssignCharacter', seatId: fay, characterId: 'washerwoman' },
		// Dawn of the first night.
		{ type: 'NewDay' },
		{ type: 'Nominate', nominator: dev, nominee: ana },
		{ type: 'Nominate', nominator: eve, nominee: ben },
		{ type: 'Execute', seatId: ana },
		{ type: 'NewDay' },
		// The Scarlet Woman becomes the Imp; the Imp kills the Empath at night.
		{ type: 'AssignCharacter', seatId: ben, characterId: 'imp' },
		{ type: 'SetDead', seatId: eve, dead: true, cause: 'demon' },
		{ type: 'NewDay' }
	);
	return { saved: toSavedGame(s, Date.UTC(2026, 9, 16)), seats };
}

describe('deriveGameRecord', () => {
	it('records the script, winner, days and each day’s log', () => {
		const { saved, seats } = playedGame();
		const record = deriveGameRecord(saved, { endedAt: 5, winner: 'evil' }, gameData);
		expect(record.script).toEqual({ name: 'Test Brewing' });
		expect(record.winner).toBe('evil');
		expect(record.role).toBe('storyteller');
		expect(record.endedAt).toBe(5);
		expect(record.days).toBe(3);
		expect(record.dayLog).toEqual([
			{ day: 0, nominations: 0, executed: [], exiled: [] },
			{ day: 1, nominations: 2, executed: [seats[0]], exiled: [] },
			{ day: 2, nominations: 0, executed: [], exiled: [] },
			{ day: 3, nominations: 0, executed: [], exiled: [] }
		]);
	});

	it('takes starting characters at the first Dawn and final ones at the end', () => {
		const { saved } = playedGame();
		const record = deriveGameRecord(saved, { endedAt: 5 }, gameData);
		const ben = record.seats[1];
		expect(ben.playerName).toBe('Ben');
		expect(ben.start).toEqual({ characterId: 'scarletwoman', alignment: 'evil' });
		expect(ben.end).toEqual({ characterId: 'imp', alignment: 'evil' });
	});

	it('counts the Drunk as the Drunk, not the Townsfolk they were shown', () => {
		const { saved } = playedGame();
		const record = deriveGameRecord(saved, { endedAt: 5 }, gameData);
		expect(record.seats[2].start?.characterId).toBe('drunk');
		expect(record.characters.drunk).toEqual({ name: 'Drunk', type: 'outsider' });
	});

	it('records deaths with their cause and day', () => {
		const { saved } = playedGame();
		const record = deriveGameRecord(saved, { endedAt: 5 }, gameData);
		expect(record.seats[0]).toMatchObject({ dead: true, deathCause: 'execution', diedOnDay: 1 });
		expect(record.seats[4]).toMatchObject({ dead: true, deathCause: 'demon', diedOnDay: 2 });
		expect(record.seats[3]).toMatchObject({ dead: false });
		expect(record.seats[3].diedOnDay).toBeUndefined();
	});

	it('uses the final characters as starting ones when the first night never ended', () => {
		const { session, ctx, seats } = newGame(['Ana']);
		const s = run(session, ctx, { type: 'AssignCharacter', seatId: seats[0], characterId: 'imp' });
		const record = deriveGameRecord(toSavedGame(s, 1), { endedAt: 2 }, gameData);
		expect(record.days).toBe(0);
		expect(record.seats[0].start).toEqual({ characterId: 'imp', alignment: 'evil' });
		expect(record.winner).toBeUndefined();
	});
});

function record(overrides: Partial<GameRecord>): GameRecord {
	return {
		recordVersion: 1,
		gameId: 'g',
		role: 'storyteller',
		createdAt: 0,
		endedAt: 0,
		script: { name: 'Trouble Brewing' },
		days: 3,
		seats: [],
		ruleCharacters: [],
		dayLog: [],
		characters: {
			imp: { name: 'Imp' as CharacterName, type: 'demon' },
			chef: { name: 'Chef' as CharacterName, type: 'townsfolk' },
			gunslinger: { name: 'Gunslinger' as CharacterName, type: 'traveller' }
		},
		...overrides
	};
}

describe('historyStats', () => {
	const a = record({
		gameId: 'a',
		endedAt: 2,
		winner: 'evil',
		days: 4,
		seats: [
			{
				seatId: '1',
				playerName: 'Ana',
				start: { characterId: 'imp', alignment: 'evil' },
				dead: false
			},
			{
				seatId: '2',
				playerName: 'Ben',
				start: { characterId: 'chef', alignment: 'good' },
				dead: true
			},
			{
				seatId: '3',
				playerName: 'Cat',
				start: { characterId: 'gunslinger', alignment: 'good' },
				dead: false
			}
		]
	});
	const b = record({
		gameId: 'b',
		endedAt: 1,
		winner: 'good',
		days: 2,
		script: { name: 'Sects & Violets', author: 'TPI' },
		seats: [
			{
				seatId: '1',
				playerName: ' ana ',
				start: { characterId: 'chef', alignment: 'good' },
				dead: false
			},
			{
				seatId: '2',
				playerName: 'Ben',
				start: { characterId: 'imp', alignment: 'evil' },
				dead: true
			}
		]
	});
	const c = record({ gameId: 'c', endedAt: 3, days: 3, seats: [] });

	it('summarises games, wins by team, and average days and players', () => {
		const { summary } = historyStats([a, b, c]);
		expect(summary).toEqual({
			games: 3,
			wins: { good: 1, evil: 1 },
			averageDays: 3,
			averagePlayers: (2 + 2 + 0) / 3
		});
		expect(historyStats([]).summary).toEqual({ games: 0, wins: { good: 0, evil: 0 } });
	});

	it('leaves Travellers out of the player count', () => {
		expect(playerCount(a)).toBe(2);
	});

	it('counts games and wins per script, telling scripts apart by name and author', () => {
		const { scripts } = historyStats([a, b, c]);
		expect(scripts.map((s) => [s.name, s.author, s.games, s.wins])).toEqual([
			['Trouble Brewing', undefined, 2, { good: 0, evil: 1 }],
			['Sects & Violets', 'TPI', 1, { good: 1, evil: 0 }]
		]);
		expect(scripts[0].lastPlayed).toBe(3);
	});

	it('counts wins per starting character over decided games', () => {
		const { characters } = historyStats([a, b, c]);
		const imp = characters.find((x) => x.characterId === 'imp');
		const chef = characters.find((x) => x.characterId === 'chef');
		expect(imp).toMatchObject({ name: 'Imp', type: 'demon', games: 2, decided: 2, wins: 1 });
		expect(chef).toMatchObject({ games: 2, decided: 2, wins: 1 });
	});

	it('matches players by name, ignoring case and spaces', () => {
		const { players } = historyStats([a, b]);
		const ana = players.find((p) => p.name === 'Ana');
		expect(ana).toEqual({
			name: 'Ana',
			games: 2,
			teams: { good: 1, evil: 1 },
			decided: 2,
			wins: 2,
			deaths: 0
		});
		expect(players.find((p) => p.name === 'Ben')).toMatchObject({ games: 2, wins: 0, deaths: 2 });
	});

	it('gives no win rate when nothing was decided', () => {
		expect(winRate(0, 0)).toBeUndefined();
		expect(winRate(1, 4)).toBe(0.25);
	});
});

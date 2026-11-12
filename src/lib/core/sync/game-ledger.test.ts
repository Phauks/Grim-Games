import { describe, expect, it } from 'vitest';
import {
	gameHistoryPath,
	historyStats,
	ledgerSite,
	parseSince,
	type LedgerGame
} from './game-ledger.ts';

const HOUR = 60 * 60 * 1000;
const day = (at: number) => new Date(at).toISOString().slice(0, 10);
const T = Date.UTC(2026, 10, 12, 18);

function game(over: Partial<LedgerGame>): LedgerGame {
	return {
		id: Math.random().toString(36),
		site: 'production',
		room: '482913',
		started: T,
		ended: T + HOUR,
		finish: 'game-over',
		players: 8,
		phones: 6,
		...over
	};
}

describe('historyStats', () => {
	it('counts games, rooms, players and wins since the start of the period', () => {
		const stats = historyStats(
			{
				games: [
					game({ script: 'Trouble Brewing', winner: 'good', players: 10 }),
					game({ script: 'Trouble Brewing', winner: 'evil', players: 7 }),
					game({ ended: T - 48 * HOUR, started: T - 49 * HOUR, winner: 'good' })
				],
				rooms: [
					{ site: 'production', room: '482913', opened: T },
					{ site: 'preview', room: '170554', opened: T - 48 * HOUR }
				]
			},
			T - HOUR,
			day
		);
		expect(stats.summary).toEqual({
			games: 2,
			rooms: 1,
			players: 17,
			averageLength: HOUR,
			wins: { good: 1, evil: 1 }
		});
	});

	it('averages the length of games ended by End game only', () => {
		const stats = historyStats(
			{
				games: [
					game({ ended: T + 2 * HOUR }),
					game({ finish: 'expired', ended: T + 20 * HOUR }),
					game({ finish: 'closed', ended: T + 5 * HOUR })
				],
				rooms: []
			},
			0,
			day
		);
		expect(stats.summary.averageLength).toBe(2 * HOUR);
	});

	it('leaves the average out when no game ended by End game', () => {
		const stats = historyStats({ games: [game({ finish: 'new-game' })], rooms: [] }, 0, day);
		expect(stats.summary).not.toHaveProperty('averageLength');
	});

	it('lists scripts by most games, with their wins and lengths', () => {
		const stats = historyStats(
			{
				games: [
					game({ script: 'Sects & Violets', winner: 'evil' }),
					game({ script: 'Trouble Brewing', winner: 'good' }),
					game({ script: 'Trouble Brewing', winner: 'good', ended: T + 3 * HOUR }),
					game({})
				],
				rooms: []
			},
			0,
			day
		);
		expect(stats.scripts).toEqual([
			{ script: 'Trouble Brewing', games: 2, good: 2, evil: 0, averageLength: 2 * HOUR },
			{ script: 'Sects & Violets', games: 1, good: 0, evil: 1, averageLength: HOUR }
		]);
	});

	it('lists days newest first, with the most games running at once', () => {
		const stats = historyStats(
			{
				games: [
					game({ started: T, ended: T + 2 * HOUR }),
					game({ started: T + HOUR, ended: T + 3 * HOUR }),
					// Starts as the first ends: not at the same time.
					game({ started: T + 2 * HOUR, ended: T + 4 * HOUR }),
					game({ started: T - 30 * HOUR, ended: T - 29 * HOUR, players: 5 })
				],
				rooms: [
					{ site: 'production', room: '1', opened: T },
					{ site: 'production', room: '2', opened: T - 30 * HOUR }
				]
			},
			0,
			day
		);
		expect(stats.days).toEqual([
			{ day: '2026-11-12', rooms: 1, games: 3, players: 24, atOnce: 2 },
			{ day: '2026-11-11', rooms: 1, games: 1, players: 5, atOnce: 1 }
		]);
	});
});

describe('history requests', () => {
	it('asks for a period or all of it', () => {
		expect(gameHistoryPath(undefined)).toBe('/api/admin/history');
		expect(gameHistoryPath(1234)).toBe('/api/admin/history?since=1234');
	});

	it('reads only a plain time as since', () => {
		expect(parseSince('1234')).toBe(1234);
		expect(parseSince(null)).toBeUndefined();
		expect(parseSince('-5')).toBeUndefined();
		expect(parseSince('1e9')).toBeUndefined();
	});

	it('names the site from the Worker environment', () => {
		expect(ledgerSite('preview')).toBe('preview');
		expect(ledgerSite('production')).toBe('production');
		expect(ledgerSite(undefined)).toBe('production');
	});
});

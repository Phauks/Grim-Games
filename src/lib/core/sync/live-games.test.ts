import { describe, expect, it } from 'vitest';
import type { SeatId } from '#lib/core/model/index.ts';
import {
	liveGame,
	liveGamePath,
	parseLiveGamePath,
	sortLiveGames,
	type LiveGame
} from './live-games.ts';
import type { PublicGameState } from './public-projection.ts';
import { gameOver, join, newRoom, publish, seat, setName } from './room.ts';

const table: PublicGameState = {
	storytellerName: 'Sam',
	seats: ['a', 'b', 'c'].map((id, i) => ({ seatId: id as SeatId, seatNumber: i + 1, dead: false })),
	today: { nominations: [], executions: [] },
	corner: { modes: [], phase: { kind: 'night', number: 2 } }
};

describe('live games', () => {
	it('sums up a room from what the room already holds', () => {
		let room = publish(newRoom('hash'), 'g1', table);
		room = seat(setName(join(room, 'm1')!, 'm1', { name: 'Ana' }), 'm1', 'a' as SeatId);
		const facts = { phones: 1, storyteller: true, games: 2, active: 5, opened: 3 };
		const game = liveGame('482913', room, { meta: { name: 'Tiny' }, entries: [] }, facts);
		expect(game).toEqual({
			code: '482913',
			active: 5,
			opened: 3,
			storyteller: true,
			games: 2,
			preview: {
				open: true,
				script: { name: 'Tiny', official: true },
				storyteller: 'Sam',
				seats: 3,
				seated: 1
			},
			phones: 1,
			phase: { kind: 'night', number: 2 }
		});
	});

	const facts = { phones: 0, storyteller: false, games: 0, active: 1 };

	it('leaves the phase out until the board is open', () => {
		expect(liveGame('482913', newRoom('hash'), undefined, facts).phase).toBeUndefined();
	});

	it('says the game in play is over, and who won how', () => {
		const room = gameOver(publish(newRoom('hash'), 'g1', table), 'g1', 'evil', 'two-alive');
		expect(liveGame('482913', room, undefined, facts).ended).toEqual({
			winner: 'evil',
			reason: 'two-alive'
		});
		// The next game is not over.
		const next = publish(room, 'g2', table);
		expect(liveGame('482913', next, undefined, facts).ended).toBeUndefined();
	});

	it('lists the most recently active room first', () => {
		const at = (code: string, active: number) => ({ code, active }) as LiveGame;
		expect(sortLiveGames([at('1', 1), at('3', 3), at('2', 2)]).map((g) => g.code)).toEqual([
			'3',
			'2',
			'1'
		]);
	});

	it('reads a room code only from a live game path', () => {
		expect(parseLiveGamePath(liveGamePath('482913'))).toBe('482913');
		expect(parseLiveGamePath('/api/admin/games')).toBeUndefined();
		expect(parseLiveGamePath('/api/admin/games/48291')).toBeUndefined();
		expect(parseLiveGamePath('/api/room/482913')).toBeUndefined();
	});
});

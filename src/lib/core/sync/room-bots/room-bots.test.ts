import { describe, expect, it } from 'vitest';
import type { PlayerView } from '#lib/core/sync/room-protocol.ts';
import { replies, type BotMemory } from './brain.ts';
import { viewProblems } from './checks.ts';
import { deal } from './deal.ts';

const self = { index: 2, name: 'Bot 3', random: () => 0 };
const seats = (n: number, names: Record<number, string> = {}) =>
	Array.from({ length: n }, (_, i) => ({
		seatId: `s${i + 1}`,
		seatNumber: i + 1,
		dead: false,
		...(names[i + 1] ? { playerName: names[i + 1] } : {})
	}));
const view = (extra: Partial<PlayerView> = {}): PlayerView => ({
	type: 'player-view',
	me: { memberId: 'm3', name: 'Bot 3' },
	takenSeats: [],
	...extra
});
const sent = (v: PlayerView, memory: BotMemory = { look: true }) => replies(v, memory, self).send;

describe('room bots', () => {
	it('names itself first, and only that', () => {
		expect(sent(view({ me: { memberId: 'm3' } }))).toEqual([{ type: 'request', name: 'Bot 3' }]);
	});

	it('claims an open seat once seating is locked, spreading bots round the table', () => {
		const v = view({
			public: { seats: seats(5, { 1: 'Ann' }), today: { nominations: [], executions: [] } }
		});
		// Seats 2 to 5 are open; the third bot takes the third of them.
		expect(sent(v)).toEqual([{ type: 'claim-seat', seatId: 's4' }]);
		expect(sent(v, { look: true, claimed: 's4' })).toEqual([]);
	});

	it('moves its own seat once while seating is open', () => {
		const v = view({
			me: { memberId: 'm3', name: 'Bot 3', seatId: 's1' },
			seatingOpen: true,
			public: { seats: seats(5), today: { nominations: [], executions: [] } }
		});
		const first = replies(v, { look: true }, self);
		expect(first.send).toEqual([{ type: 'sit', after: 's3' }]);
		expect(replies(v, first.memory, self).send).toEqual([]);
	});

	it('taps its own place in the count off, or the first number free', () => {
		const tokens = [{ number: 3, name: 'Ann' }];
		expect(sent(view({ countOff: { size: 5, tokens: [] } }))).toEqual([
			{ type: 'count', number: 3 }
		]);
		expect(sent(view({ countOff: { size: 5, tokens } }))).toEqual([{ type: 'count', number: 1 }]);
	});

	it('holds to see each new character once', () => {
		const v = view({
			me: { memberId: 'm3', name: 'Bot 3', seatId: 's1' },
			takenSeats: ['s1'],
			role: { characterId: 'imp' }
		});
		const first = replies(v, { look: true }, self);
		expect(first.send).toEqual([{ type: 'role-seen' }]);
		expect(replies(v, first.memory, self).send).toEqual([]);
		expect(replies({ ...v, role: { characterId: 'chef' } }, first.memory, self).send).toEqual([
			{ type: 'role-seen' }
		]);
	});

	it('rates a game that ended, once', () => {
		const [message] = sent(view({ endedGameId: 'g1' }));
		expect(message).toMatchObject({ type: 'feedback', gameId: 'g1', feedback: { version: 1 } });
		expect(sent(view({ endedGameId: 'g1' }), { look: true, feedbackFor: 'g1' })).toEqual([]);
	});

	it('ranks every option in a ranked script vote', () => {
		const options = [
			{ id: 'a', name: 'A' },
			{ id: 'b', name: 'B' }
		];
		const [ballot] = sent(view({ scriptVote: { voteId: 'v', kind: 'ranked', options } }));
		expect(ballot).toMatchObject({ type: 'script-ballot', voteId: 'v' });
		expect([...(ballot as { choices: string[] }).choices].sort()).toEqual(['a', 'b']);
	});

	it('flags two phones in one seat, and a character with no seat', () => {
		const a = view({ me: { memberId: 'a', seatId: 's1' }, takenSeats: ['s1'] });
		const b = view({ me: { memberId: 'b', seatId: 's1' }, takenSeats: ['s1'] });
		const c = view({ me: { memberId: 'c' }, role: { characterId: 'imp' } });
		expect(
			viewProblems(
				new Map([
					['A', a],
					['B', b],
					['C', c]
				])
			)
		).toEqual(['C was sent a character with no seat', 'A and B all sit in s1']);
	});

	it('deals one Demon, and Travellers past 15 players', () => {
		const roles = deal(20);
		expect(roles).toHaveLength(20);
		expect(roles.filter((r) => r.characterId === 'imp')).toHaveLength(1);
		expect(roles.filter((r) => r.alignment === 'evil').length).toBeGreaterThanOrEqual(4);
	});
});

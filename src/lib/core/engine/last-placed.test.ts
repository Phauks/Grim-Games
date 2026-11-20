import { describe, expect, it } from 'vitest';
import { newGame, run } from '#lib/core/model/fixtures.test-support.ts';
import type { GameSession } from './log.ts';
import type { Command } from './commands.ts';
import { lastPlaced, tokenHistory } from './last-placed.ts';

const token = { characterId: 'poisoner', label: 'Poisoned' };
const add = (seatId: string): Command => ({ type: 'AddReminder', seatId, reminder: token });
/** The id of the newest copy of the token on the board. */
function newest(s: GameSession): string {
	const all = s.game.seating.flatMap((id) => s.game.seats[id].reminders);
	const found = all.filter((r) => r.label === token.label).at(-1);
	if (!found) throw new Error('no token');
	return found.reminderId;
}
const last = (s: GameSession) => lastPlaced(s.log, token.characterId, token.label);

describe('lastPlaced', () => {
	it('is empty on the first night', () => {
		const { session, ctx, seats } = newGame(5);
		expect(last(run(session, ctx, add(seats[1])))).toEqual([]);
	});

	it("names last night's seat after it came off at Dusk", () => {
		const { session, ctx, seats } = newGame(5);
		let s = run(session, ctx, add(seats[1]), { type: 'NewDay' });
		s = run(s, ctx, { type: 'RemoveReminder', reminderId: newest(s) }, { type: 'Dusk' });
		expect(last(s)).toEqual([{ seatId: seats[1], phase: { kind: 'night', number: 1 } }]);
	});

	it('follows a move during the night and leaves tonight out', () => {
		const { session, ctx, seats } = newGame(5);
		let s = run(session, ctx, add(seats[1]));
		s = run(s, ctx, { type: 'MoveReminder', reminderId: newest(s), toSeatId: seats[2] });
		// Dusk takes it off; tonight's pick, after Dusk, is not last night's.
		s = run(s, ctx, { type: 'NewDay' }, { type: 'Dusk' }, add(seats[4]));
		expect(last(s)).toEqual([{ seatId: seats[2], phase: { kind: 'night', number: 1 } }]);
	});

	it('marks a token placed during the day as today, once Dusk bounds the day', () => {
		const { session, ctx, seats } = newGame(5);
		const day = run(session, ctx, { type: 'NewDay' }, add(seats[3]));
		// Without a Dusk, tonight's placements would look the same: left out.
		expect(last(day)).toEqual([]);
		expect(last(run(day, ctx, { type: 'Dusk' }))).toEqual([
			{ seatId: seats[3], phase: { kind: 'day', number: 1 } }
		]);
	});

	it('numbers the night as the day view does', () => {
		const { session, ctx, seats } = newGame(5);
		let s = run(session, ctx, add(seats[1]), { type: 'NewDay' }, { type: 'Dusk' }, add(seats[2]));
		s = run(s, ctx, { type: 'NewDay' });
		expect(last(s)).toEqual([{ seatId: seats[2], phase: { kind: 'night', number: 2 } }]);
	});

	it('forgets the night before last', () => {
		const { session, ctx, seats } = newGame(5);
		let s = run(session, ctx, add(seats[1]), { type: 'NewDay' });
		s = run(s, ctx, { type: 'RemoveReminder', reminderId: newest(s) }, { type: 'Dusk' });
		s = run(s, ctx, { type: 'NewDay' }, { type: 'Dusk' });
		expect(last(s)).toEqual([]);
	});
});

describe('tokenHistory', () => {
	it('lists each seat the token was put on, with its night or day', () => {
		const { session, ctx, seats } = newGame(5);
		let s = run(session, ctx, add(seats[1]), { type: 'NewDay' });
		s = run(s, ctx, { type: 'MoveReminder', reminderId: newest(s), toSeatId: seats[3] });
		s = run(s, ctx, { type: 'Dusk' }, add(seats[2]), { type: 'NewDay' });
		expect(tokenHistory(s.log, token.characterId, token.label)).toEqual([
			{ seatId: seats[1], phase: { kind: 'night', number: 1 } },
			{ seatId: seats[3], phase: { kind: 'day', number: 1 } },
			{ seatId: seats[2], phase: { kind: 'night', number: 2 } }
		]);
	});
});

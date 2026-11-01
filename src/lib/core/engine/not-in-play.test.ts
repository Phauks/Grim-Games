/**
 * Seats not in play yet (Trevor, 2026-10-31): a Traveller who arrives mid-game sits down
 * before the night they join at, and counts for nothing until then. The wiki lets Travellers
 * join "at any time" (https://wiki.bloodontheclocktower.com/Travellers); waiting for the night
 * is the table's choice, so the Storyteller can put a seat in play or take it out at will.
 */
import { describe, expect, it } from 'vitest';
import { newGame, run, warned } from '#lib/core/model/fixtures.test-support.ts';
import { inPlay } from '#lib/core/model/index.ts';
import {
	blockThreshold,
	exileThreshold,
	livingByTeam,
	townCounts
} from '#lib/core/rules/voting.ts';
import { undo } from './log.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve'];

function withArrival() {
	const { session, ctx, seats } = newGame(names);
	const s = run(session, ctx, { type: 'AddSeat', playerName: 'Fay', notInPlay: true });
	const fay = s.game.seating[5];
	return { session: s, ctx, seats, fay };
}

describe('seats not in play', () => {
	it('adds a seat that is not in play, and puts it in play as one change', () => {
		const { session, ctx, fay } = withArrival();
		expect(session.game.seats[fay].notInPlay).toBe(true);
		const s = run(session, ctx, { type: 'SetInPlay', seatIds: [fay], inPlay: true });
		expect(s.game.seats[fay].notInPlay).toBeUndefined();
		expect(undo(s).game.seats[fay].notInPlay).toBe(true);
		expect(warned(s, ctx, { type: 'SetInPlay', seatIds: [fay], inPlay: true })).toEqual([
			'no-change'
		]);
		const out = run(s, ctx, { type: 'SetInPlay', seatIds: [fay], inPlay: false });
		expect(out.game.seats[fay].notInPlay).toBe(true);
	});

	it('leaves the seat out of the alive count, the votes needed and the exile count', () => {
		const { session, ctx, fay } = withArrival();
		expect(inPlay(session.game).seating).not.toContain(fay);
		expect(blockThreshold(session.game)).toEqual({ alive: 5, needed: 3 });
		// The day timer's time per living player follows this count too.
		expect(livingByTeam(session.game).alive).toBe(5);
		const traveller = run(session, ctx, {
			type: 'AssignCharacter',
			seatId: fay,
			characterId: 'scapegoat',
			alignment: 'good'
		});
		// Not in play: no living Traveller yet, so nobody can be exiled.
		expect(exileThreshold(traveller.game, ctx.characters)).toBeUndefined();
		const joined = run(traveller, ctx, { type: 'SetInPlay', seatIds: [fay], inPlay: true });
		expect(blockThreshold(joined.game)).toEqual({ alive: 6, needed: 3 });
		expect(exileThreshold(joined.game, ctx.characters)).toBe(3);
	});

	it("leaves the seat out of the phones' counts", () => {
		const counts = townCounts([
			{ dead: false },
			{ dead: false },
			{ dead: true, ghostVote: 'unused' },
			{ dead: false, notInPlay: true }
		]);
		expect(counts).toMatchObject({ alive: 2, total: 3, needed: 1, ghostVotes: 1 });
	});

	it('warns when a seat not in play nominates or is nominated, and still records it', () => {
		const { session, ctx, seats, fay } = withArrival();
		expect(warned(session, ctx, { type: 'Nominate', nominator: fay, nominee: seats[0] })).toEqual([
			'not-in-play'
		]);
		expect(warned(session, ctx, { type: 'Nominate', nominator: seats[0], nominee: fay })).toEqual([
			'not-in-play'
		]);
	});
});

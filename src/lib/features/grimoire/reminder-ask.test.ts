import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import type { Script } from '#lib/core/data/index.ts';
import { GENERIC_REMINDER_ID, type Game, type SeatId } from '#lib/core/model/index.ts';
import {
	newGame,
	run,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import { onBoard } from './reminders.ts';
import { deadOwner, freshAsks, type ReminderLook } from './reminder-ask.ts';

const script: Script = {
	entries: ['fanggu', 'poisoner', 'chef'].map((id) => ({ kind: 'official', id }))
};

/**
 * Three seats (the Fang Gu, the Poisoner, the Chef) looked at once, then `then` run. Returns
 * the game after, the look from before, and `more` to run further commands.
 */
function setup(then: (seats: SeatId[]) => Command[]) {
	const { session, ctx, seats } = newGame(3, { script });
	const cast = run(
		session,
		ctx,
		{ type: 'AssignCharacter', seatId: seats[0], characterId: 'fanggu' },
		{ type: 'AssignCharacter', seatId: seats[1], characterId: 'poisoner' },
		{ type: 'AssignCharacter', seatId: seats[2], characterId: 'chef' }
	);
	const before: ReminderLook = freshAsks(cast.game, characters, undefined).look;
	const after = run(cast, ctx, ...then(seats));
	const more = (...commands: Command[]): Game => run(after, ctx, ...commands).game;
	return { game: after.game, before, seats, more };
}

const fangGuDead = (seatId: SeatId): Command => ({
	type: 'AddReminder',
	seatId,
	reminder: { characterId: 'fanggu', label: 'Dead' }
});

describe('freshAsks', () => {
	it('asks nothing when the board has just opened', () => {
		const { game } = setup((seats) => [fangGuDead(seats[2])]);
		const first = freshAsks(game, characters, undefined);
		expect([first.asks, first.dead]).toEqual([[], []]);
	});

	// https://wiki.bloodontheclocktower.com/Fang_Gu: the Fang Gu kills, so its Dead reminder
	// names it as the cause.
	it('asks to mark a living player dead when a Dead reminder is placed, with its cause', () => {
		const { game, before, seats } = setup((seats) => [fangGuDead(seats[2])]);
		expect(freshAsks(game, characters, before).asks).toEqual([
			{ seatId: seats[2], prompt: 'markDead', cause: 'fanggu' }
		]);
	});

	// https://wiki.bloodontheclocktower.com/Vortox: the Vortox kills each night*, so its Dead
	// reminder asks too. A copy made on "+ New token" shows the same words and art, so it asks
	// as the reminder it copies (M21; Trevor, 2026-11-02: a Vortox Dead didn't ask).
	it('asks for a copy of a Dead reminder as for the reminder itself, and for an ∞ token saying Dead', () => {
		const like = { characterId: 'fanggu', label: 'Dead' };
		const generic = { characterId: GENERIC_REMINDER_ID, label: '' };
		const { game, before, seats, more } = setup(() => [
			{ type: 'AddGenericToken', look: { note: 'Dead', like } },
			{ type: 'AddGenericToken', look: { note: 'dead' } },
			{ type: 'AddGenericToken', look: { note: 'Safe', like } }
		]);
		const [copy, words, renamed] = game.genericTokens!;
		const placed = more(
			{ type: 'AddReminder', seatId: seats[0], reminder: generic, tokenId: copy.tokenId },
			{ type: 'AddReminder', seatId: seats[1], reminder: generic, tokenId: words.tokenId },
			{ type: 'AddReminder', seatId: seats[2], reminder: generic, tokenId: renamed.tokenId }
		);
		expect(freshAsks(placed, characters, before).asks).toEqual([
			{ seatId: seats[0], prompt: 'markDead', cause: 'fanggu' },
			{ seatId: seats[1], prompt: 'markDead', cause: undefined }
		]);
	});

	it('asks nothing for a reminder already there at the last look', () => {
		const { game } = setup((seats) => [fangGuDead(seats[2])]);
		const look = freshAsks(game, characters, undefined).look;
		expect(freshAsks(game, characters, look).asks).toEqual([]);
	});

	it('asks before placing a dead player’s reminder, remembering where it came from', () => {
		const { game, before, seats, more } = setup((seats) => [
			{ type: 'SetDead', seatId: seats[1], dead: true },
			{
				type: 'AddReminder',
				seatId: seats[2],
				reminder: { characterId: 'poisoner', label: 'Poisoned' }
			}
		]);
		const placed = freshAsks(game, characters, before);
		expect(placed.dead.map((d) => [d.seatId, d.reminder.label, d.from])).toEqual([
			[seats[2], 'Poisoned', undefined]
		]);
		const reminder = onBoard(game)[0];
		expect(deadOwner(game, reminder)).toBe(seats[1]);
		const moved = more({
			type: 'MoveReminder',
			reminderId: reminder.reminderId,
			toSeatId: seats[0]
		});
		expect(freshAsks(moved, characters, placed.look).dead[0]).toMatchObject({
			seatId: seats[0],
			from: seats[2]
		});
	});
});

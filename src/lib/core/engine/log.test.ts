import { describe, expect, it } from 'vitest';
import { newGame, run, testContext, testScript } from '#lib/core/model/fixtures.test-support.ts';
import type { Command } from './commands.ts';
import type { GameEvent } from './events.ts';
import {
	canRedo,
	canUndo,
	dispatch,
	history,
	openSession,
	redo,
	replay,
	undo,
	type GameSession
} from './log.ts';
import { applyEvent, applyEvents } from './reducer.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve'];

function script(seats: string[]): Command[] {
	return [
		{ type: 'AssignCharacter', seatId: seats[0], characterId: 'imp' },
		{ type: 'AssignCharacter', seatId: seats[1], characterId: 'washerwoman' },
		{
			type: 'AddReminder',
			seatId: seats[1],
			reminder: { characterId: 'drunk', label: 'Is The Drunk' }
		},
		{ type: 'SetDead', seatId: seats[2], dead: true },
		{ type: 'SpendGhostVote', seatId: seats[2] },
		{ type: 'SwapSeats', seatA: seats[0], seatB: seats[3] },
		{ type: 'SetOverride', seatId: seats[4], override: { field: 'canDie', value: false } },
		{ type: 'AddRuleCharacter', characterId: 'djinn' },
		{ type: 'SetBluffs', set: 0, characterIds: ['chef', 'monk', 'saint'] },
		{ type: 'AddSeat', playerName: 'Fay' },
		{ type: 'BuildBag', includeTravellers: false, tiles: [{ shows: 'chef', grimoire: 'chef' }] }
	];
}

/** Every intermediate game while running the commands one by one. */
function states(session: GameSession, ctx: ReturnType<typeof testContext>, commands: Command[]) {
	const sessions = [session];
	for (const command of commands) sessions.push(run(sessions.at(-1)!, ctx, command));
	return sessions;
}

describe('undo and redo', () => {
	it('steps back through every command and forward again to identical games', () => {
		const { session, ctx, seats } = newGame(names);
		const sessions = states(session, ctx, script(seats));
		let current: GameSession = sessions.at(-1)!;
		for (let i = sessions.length - 2; i >= 0; i--) {
			expect(canUndo(current)).toBe(true);
			current = undo(current);
			expect(current.game).toEqual(sessions[i].game);
		}
		for (let i = 1; i < sessions.length; i++) {
			expect(canRedo(current)).toBe(true);
			current = redo(current);
			expect(current.game).toEqual(sessions[i].game);
		}
		expect(canRedo(current)).toBe(false);
	});

	it('cannot undo creating the game, and undo/redo at the ends change nothing', () => {
		const { session } = newGame(5);
		expect(canUndo(session)).toBe(false);
		expect(undo(session)).toBe(session);
		expect(canRedo(session)).toBe(false);
		expect(redo(session)).toBe(session);
	});

	it('undoes a multi-event command in one step', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'SetDead', seatId: seats[0], dead: true },
			{ type: 'SpendGhostVote', seatId: seats[0] },
			{ type: 'SetDead', seatId: seats[0], dead: false }
		);
		expect(s.log.entries.at(-1)!.events).toHaveLength(2);
		const back = undo(s);
		expect(back.game.seats[seats[0]]).toMatchObject({ dead: true, ghostVoteUsed: true });
	});

	it('drops the redo stack when a new command runs after an undo', () => {
		const { session, ctx, seats } = newGame(5);
		const s = run(
			session,
			ctx,
			{ type: 'SetDead', seatId: seats[0], dead: true },
			{ type: 'SetDead', seatId: seats[1], dead: true }
		);
		const back = undo(s);
		expect(canRedo(back)).toBe(true);
		const branched = run(back, ctx, { type: 'SetDead', seatId: seats[2], dead: true });
		expect(canRedo(branched)).toBe(false);
		expect(branched.log.entries).toHaveLength(3);
		expect(branched.game.seats[seats[1]].dead).toBe(false);
		expect(branched.game.seats[seats[2]].dead).toBe(true);
	});

	it('adds no entry for a command that changes nothing, and none for a refused one', () => {
		const { session, ctx, seats } = newGame(5);
		const noop = dispatch(session, { type: 'SetDead', seatId: seats[0], dead: false }, ctx);
		expect(noop.ok && noop.session).toBe(session);
		const bad = dispatch(session, { type: 'SetDead', seatId: 'nobody', dead: true }, ctx);
		expect(bad.ok).toBe(false);
		expect(session.log.entries).toHaveLength(1);
	});
});

describe('the log', () => {
	it('replays to the same game the session holds', () => {
		const { session, ctx, seats } = newGame(names);
		const end = states(session, ctx, script(seats)).at(-1)!;
		expect(replay(end.log)).toEqual(end.game);
		expect(openSession(JSON.parse(JSON.stringify(end.log))).game).toEqual(end.game);
	});

	it('is deterministic for the same commands and context', () => {
		const a = newGame(names);
		const b = newGame(names);
		const endA = states(a.session, a.ctx, script(a.seats)).at(-1)!;
		const endB = states(b.session, b.ctx, script(b.seats)).at(-1)!;
		expect(endA.log).toEqual(endB.log);
	});

	it('records the command, time and warnings of each entry', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(session, ctx, { type: 'SpendGhostVote', seatId: seats[0] });
		const last = history(s).at(-1)!;
		expect(last.command).toBe('SpendGhostVote');
		expect(last.at).toBeGreaterThan(s.game.createdAt);
		expect(last.warnings?.map((w) => w.code)).toEqual(['ghost-vote-while-alive']);
		expect(history(undo(s))).toHaveLength(history(s).length - 1);
		expect(history(s)[0].command).toBe('CreateGame');
	});

	it('refuses to replay a log without a game', () => {
		expect(() => replay({ entries: [], cursor: 0 })).toThrow();
	});

	it('does not mutate earlier games', () => {
		const { session, ctx, seats } = newGame(names);
		const frozen = JSON.stringify(session.game);
		states(session, ctx, script(seats));
		expect(JSON.stringify(session.game)).toBe(frozen);
	});
});

describe('reducer', () => {
	const created: GameEvent = {
		type: 'GameCreated',
		gameId: 'g',
		createdAt: 0,
		script: testScript,
		seatIds: ['a', 'b']
	};

	it('needs GameCreated first', () => {
		expect(() => applyEvent(undefined, { type: 'BagCleared' })).toThrow();
	});

	it('ignores events about things that no longer exist', () => {
		const game = applyEvent(undefined, created);
		const events: GameEvent[] = [
			{ type: 'SeatRemoved', seatId: 'x' },
			{ type: 'SeatRenamed', seatId: 'x', playerName: 'X' },
			{ type: 'DeathSet', seatId: 'x', dead: true },
			{ type: 'ReminderMoved', reminderId: 'r', toSeatId: 'a' },
			{ type: 'ReminderRemoved', reminderId: 'r' },
			{ type: 'SeatsSwapped', seatA: 'a', seatB: 'x' },
			{ type: 'BluffsSet', set: 5, characterIds: ['chef'] },
			{ type: 'TileDrawn', tileId: 't', seatId: 'a' },
			{ type: 'DrawConfirmed', tileId: 't' },
			{ type: 'DrawCancelled', tileId: 't', position: 0 },
			{ type: 'SeatAdded', seatId: 'a', position: 0 }
		];
		expect(applyEvents(game, events)).toEqual(game);
	});

	it('moves a reminder only to an existing seat', () => {
		const game = applyEvents(undefined, [
			created,
			{
				type: 'ReminderAdded',
				seatId: 'a',
				reminder: { reminderId: 'r', characterId: 'imp', label: 'X' }
			}
		])!;
		expect(applyEvent(game, { type: 'ReminderMoved', reminderId: 'r', toSeatId: 'x' })).toBe(game);
		expect(applyEvent(game, { type: 'ReminderMoved', reminderId: 'r', toSeatId: 'a' })).toBe(game);
	});

	it('clamps positions and ignores duplicate rule characters', () => {
		const game = applyEvents(undefined, [
			created,
			{ type: 'SeatAdded', seatId: 'c', position: 99 },
			{ type: 'RuleCharacterAdded', characterId: 'djinn' },
			{ type: 'RuleCharacterAdded', characterId: 'djinn' }
		])!;
		expect(game.seating).toEqual(['a', 'b', 'c']);
		expect(game.ruleCharacters).toEqual(['djinn']);
	});
});

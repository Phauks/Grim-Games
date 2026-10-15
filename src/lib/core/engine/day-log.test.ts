/**
 * The day log: nominations, executions, ability uses, notes and night info, cleared by hand
 * with "New day". Rules sources:
 * - https://wiki.bloodontheclocktower.com/Glossary ("Nomination", "Execution")
 * - https://wiki.bloodontheclocktower.com/Slayer and /Virgin ("No Ability" once used)
 */
import { describe, expect, it } from 'vitest';
import { newGame, run } from '#lib/core/model/fixtures.test-support.ts';
import type { Command } from './commands.ts';
import type { EngineContext } from './context.ts';
import { dispatch, undo, type GameSession } from './log.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve'];

function setup() {
	const { session, ctx, seats } = newGame(names);
	const s = run(
		session,
		ctx,
		{ type: 'AssignCharacter', seatId: seats[0], characterId: 'imp' },
		{ type: 'AssignCharacter', seatId: seats[1], characterId: 'slayer' },
		{ type: 'AssignCharacter', seatId: seats[2], characterId: 'virgin' },
		{ type: 'AssignCharacter', seatId: seats[3], characterId: 'poisoner' },
		{ type: 'AssignCharacter', seatId: seats[4], characterId: 'washerwoman' }
	);
	return { session: s, ctx, seats };
}

function warned(session: GameSession, ctx: EngineContext, command: Command): string[] {
	const result = dispatch(session, command, ctx);
	if (!result.ok) throw new Error(`${command.type} refused: ${result.error.message}`);
	return result.warnings.map((w) => w.code);
}

function refused(session: GameSession, ctx: EngineContext, command: Command): string {
	const result = dispatch(session, command, ctx);
	if (result.ok) throw new Error(`${command.type} was accepted`);
	return result.error.code;
}

describe('a new game', () => {
	it('starts with an empty day log and no past days', () => {
		const { session } = setup();
		expect(session.game.today).toEqual({ entries: [] });
		expect(session.game.pastDays).toEqual([]);
	});
});

describe('Nominate', () => {
	it('logs who nominated whom, in order', () => {
		const { session, ctx, seats } = setup();
		const s = run(
			session,
			ctx,
			{ type: 'Nominate', nominator: seats[3], nominee: seats[1] },
			{ type: 'Nominate', nominator: seats[1], nominee: seats[3] }
		);
		expect(s.game.today.entries).toEqual([
			{ kind: 'nomination', entryId: expect.any(String), nominator: seats[3], nominee: seats[1] },
			{ kind: 'nomination', entryId: expect.any(String), nominator: seats[1], nominee: seats[3] }
		]);
	});

	it('warns, but allows, a second nomination by or of the same player', () => {
		const { session, ctx, seats } = setup();
		const s = run(session, ctx, { type: 'Nominate', nominator: seats[0], nominee: seats[1] });
		expect(warned(s, ctx, { type: 'Nominate', nominator: seats[0], nominee: seats[2] })).toEqual([
			'already-nominated'
		]);
		expect(warned(s, ctx, { type: 'Nominate', nominator: seats[2], nominee: seats[1] })).toEqual([
			'already-nominee'
		]);
	});

	it('warns when a dead player nominates', () => {
		const { session, ctx, seats } = setup();
		const s = run(session, ctx, { type: 'SetDead', seatId: seats[2], dead: true });
		expect(warned(s, ctx, { type: 'Nominate', nominator: seats[2], nominee: seats[0] })).toEqual([
			'dead-nominator'
		]);
	});

	it('refuses an unknown seat', () => {
		const { session, ctx, seats } = setup();
		expect(
			refused(session, ctx, { type: 'Nominate', nominator: 'nobody', nominee: seats[0] })
		).toBe('unknown-seat');
	});

	it('can be edited and removed by the Storyteller', () => {
		const { session, ctx, seats } = setup();
		let s = run(session, ctx, { type: 'Nominate', nominator: seats[0], nominee: seats[1] });
		const entryId = s.game.today.entries[0].entryId;
		s = run(s, ctx, { type: 'EditNomination', entryId, nominator: seats[3], nominee: seats[1] });
		expect(s.game.today.entries[0]).toMatchObject({ nominator: seats[3], nominee: seats[1] });
		s = run(s, ctx, { type: 'RemoveDayEntry', entryId });
		expect(s.game.today.entries).toEqual([]);
	});
});

describe('SetDemonVoted', () => {
	it('marks and clears whether the Demon voted, with undo', () => {
		const { session, ctx } = setup();
		const s = run(session, ctx, { type: 'SetDemonVoted', voted: true });
		expect(s.game.today.demonVoted).toBe(true);
		const cleared = run(s, ctx, { type: 'SetDemonVoted' });
		expect('demonVoted' in cleared.game.today).toBe(false);
		expect(undo(s).game.today.demonVoted).toBeUndefined();
	});

	it('changes nothing when the mark is the same', () => {
		const { session, ctx } = setup();
		expect(warned(session, ctx, { type: 'SetDemonVoted' })).toEqual(['no-change']);
	});
});

describe('Execute', () => {
	it('logs the execution and kills the player by execution', () => {
		const { session, ctx, seats } = setup();
		const s = run(session, ctx, { type: 'Execute', seatId: seats[3] });
		expect(s.game.seats[seats[3]]).toMatchObject({ dead: true, deathCause: 'execution' });
		expect(s.game.today.entries).toEqual([
			{ kind: 'execution', entryId: expect.any(String), seatId: seats[3], died: true }
		]);
		// One command, so one undo brings the player back and empties the log.
		const back = undo(s);
		expect(back.game.seats[seats[3]].dead).toBe(false);
		expect(back.game.today.entries).toEqual([]);
	});

	it('only logs executing a dead player, who does not die again', () => {
		const { session, ctx, seats } = setup();
		const s = run(session, ctx, { type: 'SetDead', seatId: seats[2], dead: true, cause: 'demon' });
		expect(warned(s, ctx, { type: 'Execute', seatId: seats[2] })).toEqual(['already-dead']);
		const after = run(s, ctx, { type: 'Execute', seatId: seats[2] });
		expect(after.game.seats[seats[2]].deathCause).toBe('demon');
		expect(after.game.today.entries[0]).toMatchObject({ kind: 'execution', died: false });
	});

	it('warns about a second execution in one day', () => {
		const { session, ctx, seats } = setup();
		const s = run(session, ctx, { type: 'Execute', seatId: seats[3] });
		expect(warned(s, ctx, { type: 'Execute', seatId: seats[1] })).toEqual(['already-executed']);
	});

	it('removing the execution brings the player back when they died by it', () => {
		const { session, ctx, seats } = setup();
		const s = run(
			session,
			ctx,
			{ type: 'Execute', seatId: seats[3] },
			{ type: 'SpendGhostVote', seatId: seats[3] }
		);
		const entryId = s.game.today.entries[0].entryId;
		const removed = run(s, ctx, { type: 'RemoveDayEntry', entryId });
		expect(removed.game.seats[seats[3]]).toMatchObject({ dead: false, ghostVoteUsed: false });
		expect(removed.game.today.entries).toEqual([]);
	});

	it('removing the execution leaves a death the Storyteller has since changed', () => {
		const { session, ctx, seats } = setup();
		const s = run(
			session,
			ctx,
			{ type: 'Execute', seatId: seats[3] },
			{ type: 'SetDeathCause', seatId: seats[3], cause: 'other' }
		);
		const entryId = s.game.today.entries[0].entryId;
		const removed = run(s, ctx, { type: 'RemoveDayEntry', entryId });
		expect(removed.game.seats[seats[3]]).toMatchObject({ dead: true, deathCause: 'other' });
	});
});

describe('UseAbility', () => {
	it('places the "No Ability" token for a once-per-game ability (Slayer)', () => {
		const { session, ctx, seats } = setup();
		const s = run(session, ctx, { type: 'UseAbility', seatId: seats[1], characterId: 'slayer' });
		const [token] = s.game.seats[seats[1]].reminders;
		expect(token).toMatchObject({ characterId: 'slayer', label: 'No Ability' });
		expect(s.game.today.entries).toEqual([
			{
				kind: 'ability',
				entryId: expect.any(String),
				seatId: seats[1],
				characterId: 'slayer',
				reminderId: token.reminderId
			}
		]);
		expect(undo(s).game.seats[seats[1]].reminders).toEqual([]);
	});

	it('only logs a use for a character with no such token', () => {
		const { session, ctx, seats } = setup();
		const s = run(session, ctx, {
			type: 'UseAbility',
			seatId: seats[4],
			characterId: 'washerwoman'
		});
		expect(s.game.seats[seats[4]].reminders).toEqual([]);
		expect(s.game.today.entries[0]).toEqual({
			kind: 'ability',
			entryId: expect.any(String),
			seatId: seats[4],
			characterId: 'washerwoman'
		});
	});

	it('warns when the token is already there, and does not place a second', () => {
		const { session, ctx, seats } = setup();
		const s = run(session, ctx, { type: 'UseAbility', seatId: seats[1], characterId: 'slayer' });
		expect(warned(s, ctx, { type: 'UseAbility', seatId: seats[1], characterId: 'slayer' })).toEqual(
			['already-used']
		);
		const twice = run(s, ctx, { type: 'UseAbility', seatId: seats[1], characterId: 'slayer' });
		expect(twice.game.seats[seats[1]].reminders).toHaveLength(1);
	});

	it('warns when the seat is not that character', () => {
		const { session, ctx, seats } = setup();
		expect(
			warned(session, ctx, { type: 'UseAbility', seatId: seats[0], characterId: 'slayer' })
		).toEqual(['not-seat-character']);
	});

	it('removing the use takes the token back off', () => {
		const { session, ctx, seats } = setup();
		const s = run(session, ctx, { type: 'UseAbility', seatId: seats[1], characterId: 'slayer' });
		const removed = run(s, ctx, {
			type: 'RemoveDayEntry',
			entryId: s.game.today.entries[0].entryId
		});
		expect(removed.game.seats[seats[1]].reminders).toEqual([]);
		expect(removed.game.today.entries).toEqual([]);
	});
});

describe('DayNote', () => {
	it('keeps long, multi-line text as written', () => {
		const { session, ctx, seats } = setup();
		const text = `Asked: is the Demon a neighbour of mine?\n\n${'Answered after a long think. '.repeat(200)}`;
		const s = run(session, ctx, { type: 'DayNote', characterId: 'artist', seatId: seats[2], text });
		expect(s.game.today.entries[0]).toEqual({
			kind: 'note',
			entryId: expect.any(String),
			characterId: 'artist',
			seatId: seats[2],
			text
		});
	});

	it('stores structured guesses, checked against seats and characters', () => {
		const { session, ctx, seats } = setup();
		const guesses = [
			{ seatId: seats[0], characterId: 'imp' },
			{ seatId: seats[3], characterId: 'baron' }
		];
		const s = run(session, ctx, {
			type: 'DayNote',
			characterId: 'juggler',
			seatId: seats[4],
			text: '',
			guesses
		});
		expect(s.game.today.entries[0]).toMatchObject({ kind: 'note', guesses });
		expect(
			refused(session, ctx, {
				type: 'DayNote',
				characterId: 'juggler',
				text: '',
				guesses: [{ seatId: seats[0], characterId: 'nobody' }]
			})
		).toBe('unknown-character');
	});

	it('skips an empty note: nothing requires one', () => {
		const { session, ctx } = setup();
		expect(warned(session, ctx, { type: 'DayNote', characterId: 'gossip', text: '  ' })).toEqual([
			'no-change'
		]);
	});

	it('can be edited, and clearing it removes it', () => {
		const { session, ctx } = setup();
		let s = run(session, ctx, { type: 'DayNote', characterId: 'gossip', text: 'first' });
		const entryId = s.game.today.entries[0].entryId;
		s = run(s, ctx, { type: 'EditDayNote', entryId, text: 'second' });
		expect(s.game.today.entries[0]).toMatchObject({ text: 'second' });
		s = run(s, ctx, { type: 'EditDayNote', entryId, text: '' });
		expect(s.game.today.entries).toEqual([]);
	});

	it('refuses to edit an entry that is not a note', () => {
		const { session, ctx, seats } = setup();
		const s = run(session, ctx, { type: 'Execute', seatId: seats[0] });
		const entryId = s.game.today.entries[0].entryId;
		expect(refused(s, ctx, { type: 'EditDayNote', entryId, text: 'x' })).toBe('wrong-entry-kind');
		expect(refused(s, ctx, { type: 'RemoveDayEntry', entryId: 'nope' })).toBe('unknown-entry');
	});
});

describe('RecordNightInfo', () => {
	it('places the reminder tokens and logs what was shown', () => {
		const { session, ctx, seats } = setup();
		const s = run(session, ctx, {
			type: 'RecordNightInfo',
			seatId: seats[4],
			characterId: 'washerwoman',
			text: 'Ben or Cat is the Slayer',
			reminders: [
				{ seatId: seats[1], reminder: { characterId: 'washerwoman', label: 'Townsfolk' } },
				{ seatId: seats[2], reminder: { characterId: 'washerwoman', label: 'Wrong' } }
			]
		});
		const townsfolk = s.game.seats[seats[1]].reminders[0];
		const wrong = s.game.seats[seats[2]].reminders[0];
		expect(townsfolk.label).toBe('Townsfolk');
		expect(wrong.label).toBe('Wrong');
		expect(s.game.today.entries[0]).toEqual({
			kind: 'info',
			entryId: expect.any(String),
			seatId: seats[4],
			characterId: 'washerwoman',
			text: 'Ben or Cat is the Slayer',
			reminderIds: [townsfolk.reminderId, wrong.reminderId]
		});
		const removed = run(s, ctx, {
			type: 'RemoveDayEntry',
			entryId: s.game.today.entries[0].entryId
		});
		expect(removed.game.seats[seats[1]].reminders).toEqual([]);
		expect(removed.game.seats[seats[2]].reminders).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Mathematician: abnormal info is recorded with why.
	it('records why the info worked abnormally, and refuses an unknown reason', () => {
		const { session, ctx, seats } = setup();
		const s = run(session, ctx, {
			type: 'RecordNightInfo',
			seatId: seats[4],
			characterId: 'washerwoman',
			text: 'Shown a lie',
			abnormal: [{ reason: 'poisoned', characterId: 'poisoner', seatId: seats[3] }]
		});
		expect(s.game.today.entries[0]).toMatchObject({
			abnormal: [{ reason: 'poisoned', characterId: 'poisoner', seatId: seats[3] }]
		});
		expect(
			refused(session, ctx, {
				type: 'RecordNightInfo',
				seatId: seats[4],
				characterId: 'washerwoman',
				text: 'x',
				abnormal: [{ reason: 'bad' as 'other' }]
			})
		).toBe('invalid-abnormal');
	});
});

describe('NewDay', () => {
	it('closes the log into history and starts an empty one, undoably', () => {
		const { session, ctx, seats } = setup();
		const s = run(
			session,
			ctx,
			{ type: 'Nominate', nominator: seats[3], nominee: seats[1] },
			{ type: 'SetDemonVoted', voted: false }
		);
		const day = s.game.today;
		const next = run(s, ctx, { type: 'NewDay' });
		expect(next.game.today).toEqual({ entries: [] });
		expect(next.game.pastDays).toEqual([{ ...day, closedAt: expect.any(Number) }]);
		// The grimoire is untouched.
		expect(next.game.seats).toEqual(s.game.seats);
		expect(undo(next).game.today).toEqual(day);
		expect(undo(next).game.pastDays).toEqual([]);
	});

	it('warns, but goes ahead, when nothing was logged', () => {
		const { session, ctx } = setup();
		expect(warned(session, ctx, { type: 'NewDay' })).toEqual(['empty-day']);
	});
});

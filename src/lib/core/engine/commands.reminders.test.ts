/** Commands: reminders, generic tokens and loose reminders (decide/reminders.ts). */
import { describe, expect, it } from 'vitest';
import { newGame, refused, run, warned } from '#lib/core/model/fixtures.test-support.ts';
import { GENERIC_REMINDER_ID, type SymbolColour } from '#lib/core/model/index.ts';
import { undo } from './log.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve'];

describe('reminders', () => {
	it('adds a reminder to a seat with a new id', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'poisoner' },
			{
				type: 'AddReminder',
				seatId: seats[1],
				reminder: { characterId: 'poisoner', label: 'Poisoned' }
			}
		);
		expect(s.warnings).toEqual([]);
		expect(s.game.seats[seats[1]].reminders).toEqual([
			{ reminderId: 'id-7', characterId: 'poisoner', label: 'Poisoned' }
		]);
	});

	it('warns about reminders the character does not have, or whose character is not in play', () => {
		const { session, ctx, seats } = newGame(names);
		expect(
			warned(session, ctx, {
				type: 'AddReminder',
				seatId: seats[0],
				reminder: { characterId: 'poisoner', label: 'Drunk' }
			})
		).toEqual(['reminder-not-for-character']);
		expect(
			warned(session, ctx, {
				type: 'AddReminder',
				seatId: seats[0],
				reminder: { characterId: 'poisoner', label: 'Poisoned' }
			})
		).toEqual(['reminder-character-not-in-play']);
		// Global reminders are available whenever the character is on the script.
		expect(
			warned(session, ctx, {
				type: 'AddReminder',
				seatId: seats[0],
				reminder: { characterId: 'drunk', label: 'Is The Drunk' }
			})
		).toEqual([]);
		expect(
			refused(session, ctx, {
				type: 'AddReminder',
				seatId: seats[0],
				reminder: { characterId: 'nope', label: 'X' }
			})
		).toBe('unknown-character');
	});

	it('warns when an "Is The …" reminder disagrees with the seat alignment', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(session, ctx, { type: 'AssignCharacter', seatId: seats[0], characterId: 'chef' });
		expect(
			warned(s, ctx, {
				type: 'AddReminder',
				seatId: seats[0],
				reminder: { characterId: 'marionette', label: 'Is The Marionette' }
			})
		).toEqual(['alignment-differs-from-true-character']);
	});

	it('moves and removes reminders', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(session, ctx, {
			type: 'AddReminder',
			seatId: seats[0],
			reminder: { characterId: 'drunk', label: 'Is The Drunk' }
		});
		const id = s.game.seats[seats[0]].reminders[0].reminderId;
		const moved = run(s, ctx, { type: 'MoveReminder', reminderId: id, toSeatId: seats[2] });
		expect(moved.game.seats[seats[0]].reminders).toEqual([]);
		expect(moved.game.seats[seats[2]].reminders.map((r) => r.reminderId)).toEqual([id]);
		expect(
			warned(moved, ctx, { type: 'MoveReminder', reminderId: id, toSeatId: seats[2] })
		).toEqual(['no-change']);
		expect(refused(moved, ctx, { type: 'MoveReminder', reminderId: 'x', toSeatId: seats[2] })).toBe(
			'unknown-reminder'
		);
		expect(refused(moved, ctx, { type: 'MoveReminder', reminderId: id, toSeatId: 'x' })).toBe(
			'unknown-seat'
		);
		const removed = run(moved, ctx, { type: 'RemoveReminder', reminderId: id });
		expect(removed.game.seats[seats[2]].reminders).toEqual([]);
		expect(refused(removed, ctx, { type: 'RemoveReminder', reminderId: id })).toBe(
			'unknown-reminder'
		);
	});
});

describe('reminders on Fabled and Loric', () => {
	// Trevor (2026-10-17): Fabled and Loric can hold reminders; others' reminders may go
	// there too, with a caution.
	it('places, moves and removes reminders held by a rule character', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AddRuleCharacter', characterId: 'fibbin' },
			{ type: 'AddRuleCharacter', characterId: 'bootlegger' },
			{ type: 'AddRuleCharacter', characterId: 'angel' },
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'imp' }
		);
		const added = run(s, ctx, {
			type: 'AddRuleReminder',
			characterId: 'fibbin',
			reminder: { characterId: 'fibbin', label: 'No Ability' }
		});
		const [held] = added.game.ruleReminders!.fibbin;
		expect(held).toMatchObject({ characterId: 'fibbin', label: 'No Ability' });

		// Onto another rule character, then onto a seat, then back.
		const toLoric = run(added, ctx, {
			type: 'MoveReminderToRuleCharacter',
			reminderId: held.reminderId,
			characterId: 'bootlegger'
		});
		expect(toLoric.game.ruleReminders!.fibbin).toEqual([]);
		expect(toLoric.game.ruleReminders!.bootlegger).toEqual([held]);
		const toSeat = run(toLoric, ctx, {
			type: 'MoveReminder',
			reminderId: held.reminderId,
			toSeatId: seats[1]
		});
		expect(toSeat.game.ruleReminders!.bootlegger).toEqual([]);
		expect(toSeat.game.seats[seats[1]].reminders).toEqual([held]);
		const back = run(toSeat, ctx, {
			type: 'MoveReminderToRuleCharacter',
			reminderId: held.reminderId,
			characterId: 'fibbin'
		});
		expect(back.game.seats[seats[1]].reminders).toEqual([]);
		expect(back.game.ruleReminders!.fibbin).toEqual([held]);

		const removed = run(back, ctx, { type: 'RemoveReminder', reminderId: held.reminderId });
		expect(removed.game.ruleReminders!.fibbin).toEqual([]);
	});

	it("warns when the reminder isn't a Fabled's or Loric's, and refuses a holder not in play", () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AddRuleCharacter', characterId: 'angel' },
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'imp' }
		);
		expect(
			warned(s, ctx, {
				type: 'AddRuleReminder',
				characterId: 'angel',
				reminder: { characterId: 'imp', label: 'Dead' }
			})
		).toContain('reminder-not-from-rule-character');
		expect(
			warned(s, ctx, {
				type: 'AddRuleReminder',
				characterId: 'angel',
				reminder: { characterId: 'angel', label: 'Protected' }
			})
		).toEqual([]);
		expect(
			refused(s, ctx, {
				type: 'AddRuleReminder',
				characterId: 'fibbin',
				reminder: { characterId: 'fibbin', label: 'No Ability' }
			})
		).toBe('rule-character-not-in-play');
		const onSeat = run(s, ctx, {
			type: 'AddReminder',
			seatId: seats[1],
			reminder: { characterId: 'imp', label: 'Dead' }
		});
		const id = onSeat.game.seats[seats[1]].reminders[0].reminderId;
		expect(
			warned(onSeat, ctx, {
				type: 'MoveReminderToRuleCharacter',
				reminderId: id,
				characterId: 'angel'
			})
		).toContain('reminder-not-from-rule-character');
	});

	it('takes its reminders away when the rule character is removed', () => {
		const { session, ctx } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AddRuleCharacter', characterId: 'angel' },
			{
				type: 'AddRuleReminder',
				characterId: 'angel',
				reminder: { characterId: 'angel', label: 'Protected' }
			},
			{ type: 'RemoveRuleCharacter', characterId: 'angel' }
		);
		expect(s.game.ruleCharacters).toEqual([]);
		expect(s.game.ruleReminders).toEqual({});
		// Undo brings both back.
		const undone = undo(s);
		expect(undone.game.ruleReminders!.angel).toHaveLength(1);
	});

	it('reads an older game without rule reminders', () => {
		const { session } = newGame(names);
		expect(session.game.ruleReminders).toBeUndefined();
	});
});

describe('the generic reminder', () => {
	// Trevor (2026-10-18): a plain ∞ reminder, as many as needed, with optional text, instead
	// of a custom reminder. It belongs to no character, so it fits anywhere without a warning.
	it('goes anywhere, takes text, and clears it when emptied', () => {
		const { session, ctx, seats } = newGame(names);
		const generic = { characterId: GENERIC_REMINDER_ID, label: '' };
		expect(
			warned(session, ctx, { type: 'AddReminder', seatId: seats[0], reminder: generic })
		).toEqual([]);
		const s = run(
			session,
			ctx,
			{ type: 'AddRuleCharacter', characterId: 'angel' },
			{ type: 'AddReminder', seatId: seats[0], reminder: generic },
			{ type: 'AddRuleReminder', characterId: 'angel', reminder: generic },
			{ type: 'PlaceLooseReminder', reminder: generic }
		);
		const onSeat = s.game.seats[seats[0]].reminders[0];
		const onAngel = s.game.ruleReminders!.angel[0];
		const loose = s.game.looseReminders![0];

		const noted = run(
			s,
			ctx,
			{ type: 'SetReminderNote', reminderId: onSeat.reminderId, note: '  Chose Sam  ' },
			{ type: 'SetReminderNote', reminderId: onAngel.reminderId, note: 'Day 2' },
			{ type: 'SetReminderNote', reminderId: loose.reminderId, note: 'Vote' }
		);
		expect(noted.game.seats[seats[0]].reminders[0].note).toBe('Chose Sam');
		expect(noted.game.ruleReminders!.angel[0].note).toBe('Day 2');
		expect(noted.game.looseReminders![0].note).toBe('Vote');
		expect(
			warned(noted, ctx, {
				type: 'SetReminderNote',
				reminderId: onSeat.reminderId,
				note: 'Chose Sam'
			})
		).toContain('no-change');

		const cleared = run(noted, ctx, {
			type: 'SetReminderNote',
			reminderId: onSeat.reminderId,
			note: '   '
		});
		expect(cleared.game.seats[seats[0]].reminders[0]).not.toHaveProperty('note');
		expect(undo(cleared).game.seats[seats[0]].reminders[0].note).toBe('Chose Sam');
		expect(refused(cleared, ctx, { type: 'SetReminderNote', reminderId: 'nope', note: 'x' })).toBe(
			'unknown-reminder'
		);
	});

	it('takes its own symbol, and clears it when emptied', () => {
		// Trevor (2026-10-19): each generic reminder carries the symbol chosen for it.
		const { session, ctx, seats } = newGame(names);
		const generic = { characterId: GENERIC_REMINDER_ID, label: '' };
		const s = run(session, ctx, { type: 'AddReminder', seatId: seats[0], reminder: generic });
		const id = s.game.seats[seats[0]].reminders[0].reminderId;
		const marked = run(s, ctx, { type: 'SetReminderSymbol', reminderId: id, symbol: ' 🦉 ' });
		expect(marked.game.seats[seats[0]].reminders[0].symbol).toBe('🦉');
		expect(
			warned(marked, ctx, { type: 'SetReminderSymbol', reminderId: id, symbol: '🦉' })
		).toContain('no-change');
		const cleared = run(marked, ctx, { type: 'SetReminderSymbol', reminderId: id });
		expect(cleared.game.seats[seats[0]].reminders[0]).not.toHaveProperty('symbol');
		expect(undo(cleared).game.seats[seats[0]].reminders[0].symbol).toBe('🦉');
		expect(
			refused(s, ctx, { type: 'SetReminderSymbol', reminderId: id, symbol: 'x'.repeat(40) })
		).toBe('invalid-symbol');
	});

	it("colours the generic reminder's symbol, or clears its colour", () => {
		// Trevor (2026-10-20): the Storyteller picks the colour of a generic token's icon.
		const { session, ctx, seats } = newGame(names);
		const s = run(session, ctx, {
			type: 'AddReminder',
			seatId: seats[0],
			reminder: { characterId: GENERIC_REMINDER_ID, label: '' }
		});
		const id = s.game.seats[seats[0]].reminders[0].reminderId;
		const red = run(s, ctx, { type: 'SetReminderSymbolColour', reminderId: id, colour: 'red' });
		expect(red.game.seats[seats[0]].reminders[0].symbolColour).toBe('red');
		expect(
			warned(red, ctx, { type: 'SetReminderSymbolColour', reminderId: id, colour: 'red' })
		).toContain('no-change');
		const cleared = run(red, ctx, { type: 'SetReminderSymbolColour', reminderId: id });
		expect(cleared.game.seats[seats[0]].reminders[0]).not.toHaveProperty('symbolColour');
		expect(undo(cleared).game.seats[seats[0]].reminders[0].symbolColour).toBe('red');
		expect(
			refused(s, ctx, {
				type: 'SetReminderSymbolColour',
				reminderId: id,
				colour: 'pink' as SymbolColour
			})
		).toBe('invalid-colour');
	});

	it("fills the generic reminder's symbol, or draws it as an outline again", () => {
		// Trevor (2026-10-23): filled or outlined is chosen per ∞ token, not for all of them.
		const { session, ctx, seats } = newGame(names);
		const s = run(session, ctx, {
			type: 'AddReminder',
			seatId: seats[0],
			reminder: { characterId: GENERIC_REMINDER_ID, label: '' }
		});
		const id = s.game.seats[seats[0]].reminders[0].reminderId;
		expect(
			warned(s, ctx, { type: 'SetReminderSymbolFill', reminderId: id, fill: false })
		).toContain('no-change');
		const filled = run(s, ctx, { type: 'SetReminderSymbolFill', reminderId: id, fill: true });
		expect(filled.game.seats[seats[0]].reminders[0].symbolFill).toBe(true);
		const outlined = run(filled, ctx, {
			type: 'SetReminderSymbolFill',
			reminderId: id,
			fill: false
		});
		expect(outlined.game.seats[seats[0]].reminders[0]).not.toHaveProperty('symbolFill');
		expect(undo(outlined).game.seats[seats[0]].reminders[0].symbolFill).toBe(true);
		expect(refused(s, ctx, { type: 'SetReminderSymbolFill', reminderId: 'nope', fill: true })).toBe(
			'unknown-reminder'
		);
	});
});

describe('bank ∞ tokens', () => {
	// Plan B9 (Trevor, 2026-10-23: "Tokens only"): "+ New token" makes a reusable ∞ token whose
	// copies start with its symbol, colour and text.
	it('makes, changes and removes a token, and its copies start with its look', () => {
		const { session, ctx, seats } = newGame(names);
		const made = run(session, ctx, {
			type: 'AddGenericToken',
			look: { note: ' Chose Sam ', symbol: 'ph:skull', symbolColour: 'red' }
		});
		const [token] = made.game.genericTokens!;
		expect(token).toEqual({
			tokenId: token.tokenId,
			note: 'Chose Sam',
			symbol: 'ph:skull',
			symbolColour: 'red'
		});
		const generic = { characterId: GENERIC_REMINDER_ID, label: '' };
		const placed = run(
			made,
			ctx,
			{ type: 'AddReminder', seatId: seats[0], reminder: generic, tokenId: token.tokenId },
			{ type: 'PlaceLooseReminder', reminder: generic, tokenId: token.tokenId }
		);
		expect(placed.game.seats[seats[0]].reminders[0]).toMatchObject({
			note: 'Chose Sam',
			symbol: 'ph:skull',
			symbolColour: 'red'
		});
		expect(placed.game.looseReminders![0].symbol).toBe('ph:skull');
		// A filled token's copies start filled (Trevor, 2026-10-23).
		const filledToken = run(placed, ctx, {
			type: 'SetGenericToken',
			tokenId: token.tokenId,
			look: { symbol: 'ph:skull', symbolFill: true }
		});
		expect(filledToken.game.genericTokens![0].symbolFill).toBe(true);
		const filledCopy = run(filledToken, ctx, {
			type: 'PlaceLooseReminder',
			reminder: generic,
			tokenId: token.tokenId
		});
		expect(filledCopy.game.looseReminders![1].symbolFill).toBe(true);
		expect(placed.game.seats[seats[0]].reminders[0]).not.toHaveProperty('symbolFill');
		// The token stays in the bank, and changing it leaves the placed copies as they are.
		const changed = run(placed, ctx, {
			type: 'SetGenericToken',
			tokenId: token.tokenId,
			look: { symbol: '🦉' }
		});
		expect(changed.game.genericTokens).toEqual([{ tokenId: token.tokenId, symbol: '🦉' }]);
		expect(changed.game.seats[seats[0]].reminders[0].symbol).toBe('ph:skull');
		expect(
			warned(changed, ctx, {
				type: 'SetGenericToken',
				tokenId: token.tokenId,
				look: { symbol: '🦉' }
			})
		).toContain('no-change');
		const removed = run(changed, ctx, { type: 'RemoveGenericToken', tokenId: token.tokenId });
		expect(removed.game).not.toHaveProperty('genericTokens');
		expect(removed.game.seats[seats[0]].reminders).toHaveLength(1);
		expect(undo(removed).game.genericTokens).toHaveLength(1);
	});

	// Trevor (2026-10-27): a character's reminder dragged onto "+ New token" makes a token that
	// remembers it, for its art and the seats it fits; a generic one is never remembered.
	it('keeps the character reminder a token copies, and its copies keep it too', () => {
		const { session, ctx, seats } = newGame(names);
		const like = { characterId: 'poisoner', label: 'Poisoned' };
		const made = run(
			session,
			ctx,
			{
				type: 'AddGenericToken',
				look: { note: 'Poisoned', like: { ...like, ownerSeatId: seats[1] } }
			},
			{ type: 'AddGenericToken', look: { like: { characterId: GENERIC_REMINDER_ID, label: '' } } }
		);
		const [token, plain] = made.game.genericTokens!;
		expect(token.like).toEqual(like);
		expect(plain).not.toHaveProperty('like');
		const generic = { characterId: GENERIC_REMINDER_ID, label: '' };
		const placed = run(made, ctx, {
			type: 'AddReminder',
			seatId: seats[0],
			reminder: generic,
			tokenId: token.tokenId
		});
		expect(placed.game.seats[seats[0]].reminders[0]).toMatchObject({ note: 'Poisoned', like });
		const same = { note: 'Poisoned', like };
		expect(
			warned(placed, ctx, { type: 'SetGenericToken', tokenId: token.tokenId, look: same })
		).toContain('no-change');
	});

	it('refuses an unknown token, a long symbol and an unknown colour', () => {
		const { session, ctx, seats } = newGame(names);
		const generic = { characterId: GENERIC_REMINDER_ID, label: '' };
		expect(
			refused(session, ctx, {
				type: 'AddReminder',
				seatId: seats[0],
				reminder: generic,
				tokenId: 'x'
			})
		).toBe('unknown-token');
		expect(refused(session, ctx, { type: 'RemoveGenericToken', tokenId: 'x' })).toBe(
			'unknown-token'
		);
		expect(
			refused(session, ctx, { type: 'AddGenericToken', look: { symbol: 'x'.repeat(40) } })
		).toBe('invalid-symbol');
		expect(
			refused(session, ctx, {
				type: 'AddGenericToken',
				look: { symbolColour: 'pink' as SymbolColour }
			})
		).toBe('invalid-colour');
	});
});

describe('loose reminders', () => {
	// Trevor (2026-10-17): a reminder put down anywhere on the board belongs to no seat.
	it('places a loose reminder, puts it on a seat or a Fabled, loosens it and removes it', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AddRuleCharacter', characterId: 'angel' },
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'imp' }
		);
		const placed = run(s, ctx, {
			type: 'PlaceLooseReminder',
			reminder: { characterId: 'imp', label: 'Dead' }
		});
		const [loose] = placed.game.looseReminders!;
		expect(loose).toMatchObject({ characterId: 'imp', label: 'Dead' });
		expect(placed.game.seats[seats[1]].reminders).toEqual([]);

		const onSeat = run(placed, ctx, {
			type: 'MoveReminder',
			reminderId: loose.reminderId,
			toSeatId: seats[1]
		});
		expect(onSeat.game.looseReminders).toEqual([]);
		expect(onSeat.game.seats[seats[1]].reminders).toEqual([loose]);

		const loosened = run(onSeat, ctx, { type: 'LoosenReminder', reminderId: loose.reminderId });
		expect(loosened.game.seats[seats[1]].reminders).toEqual([]);
		expect(loosened.game.looseReminders).toEqual([loose]);
		expect(
			warned(loosened, ctx, { type: 'LoosenReminder', reminderId: loose.reminderId })
		).toContain('no-change');

		const onAngel = run(loosened, ctx, {
			type: 'MoveReminderToRuleCharacter',
			reminderId: loose.reminderId,
			characterId: 'angel'
		});
		expect(onAngel.game.looseReminders).toEqual([]);
		expect(onAngel.game.ruleReminders!.angel).toEqual([loose]);
		const offAngel = run(onAngel, ctx, { type: 'LoosenReminder', reminderId: loose.reminderId });
		expect(offAngel.game.ruleReminders!.angel).toEqual([]);
		expect(offAngel.game.looseReminders).toEqual([loose]);

		const removed = run(offAngel, ctx, { type: 'RemoveReminder', reminderId: loose.reminderId });
		expect(removed.game.looseReminders).toEqual([]);
		expect(undo(removed).game.looseReminders).toEqual([loose]);
	});

	it('refuses to loosen a reminder that is nowhere, and reads older games', () => {
		const { session, ctx } = newGame(names);
		expect(session.game.looseReminders).toBeUndefined();
		expect(refused(session, ctx, { type: 'LoosenReminder', reminderId: 'nope' })).toBe(
			'unknown-reminder'
		);
	});
});

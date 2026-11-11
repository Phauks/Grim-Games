import { defaultAlignment } from '#lib/core/data/index.ts';
import {
	isSymbolColour,
	numberSymbol,
	reminderHolder,
	replacedBy,
	type Reminder,
	type ReminderInstance
} from '#lib/core/model/index.ts';
import { COUNTER_TIMES } from '#lib/core/data/parts/counter.ts';
import { REMINDER_EFFECTS } from '#lib/core/data/parts/picked-effect.ts';
import { counterMoves } from '#lib/core/rules/reminders/counters.ts';
import { fixedReminderMove } from '#lib/core/rules/reminders/reminder-movement.ts';
import { pickedEffectOf } from '#lib/core/rules/reminders/reminder-effects.ts';
import type { GameEvent } from '../events.ts';
import {
	checkCountsUp,
	checkReminder,
	checkSymbol,
	genericLook,
	heldReminder,
	refuse,
	reminderFrom,
	ruleHolderOf,
	seatOf,
	startLook,
	warnIfNotRuleReminder,
	type Deciders
} from './shared.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

/** Reminder tokens: placing, moving, notes, symbols and generic tokens. */
export const REMINDERS_DECIDERS: Deciders<
	| 'AddReminder'
	| 'ApplySetupReminders'
	| 'MoveReminder'
	| 'RemoveReminder'
	| 'AddRuleReminder'
	| 'MoveReminderToRuleCharacter'
	| 'SetReminderNote'
	| 'SetReminderEffect'
	| 'SetReminderMadAs'
	| 'SetReminderSymbol'
	| 'SetReminderSymbolColour'
	| 'SetReminderSymbolFill'
	| 'SetReminderCountsUp'
	| 'AdvanceCounters'
	| 'PlaceLooseReminder'
	| 'AddGenericToken'
	| 'SetGenericToken'
	| 'RemoveGenericToken'
	| 'LoosenReminder'
> = {
	AddReminder(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		const reminder: Reminder = reminderFrom(game, command.reminder);
		const look = startLook(game, reminder, command.tokenId, command.look);
		checkReminder(game, reminder, ctx, warn);
		const replaces = replacedBy(reminder, ctx.characters);
		if (replaces && seat.alignment !== undefined) {
			const expected = defaultAlignment(replaces.type);
			if (expected !== undefined && expected !== seat.alignment) {
				warn(
					'alignment-differs-from-true-character',
					`the ${replaces.name} is ${expected} but this seat is ${seat.alignment}`
				);
			}
		}
		return [
			{
				type: 'ReminderAdded',
				seatId: seat.seatId,
				reminder: { reminderId: ctx.newId(), ...reminder, ...look }
			}
		];
	},

	ApplySetupReminders(game, command, ctx, warn) {
		const seats = command.placements.map((p) => seatOf(game, p.seatId));
		if (seats.length === 0) {
			warn('no-change', 'there are no reminders to place');
			return [];
		}
		return command.placements.map((p, i): GameEvent => {
			const reminder: Reminder = reminderFrom(game, p.reminder);
			checkReminder(game, reminder, ctx, warn);
			return {
				type: 'ReminderAdded',
				seatId: seats[i].seatId,
				reminder: { reminderId: ctx.newId(), ...reminder }
			};
		});
	},

	MoveReminder(game, command, ctx, warn) {
		const to = seatOf(game, command.toSeatId);
		// Off a Fabled or Loric and onto a seat.
		const holder = reminderHolder(game, command.reminderId);
		if (holder && !('seatId' in holder)) {
			return [{ type: 'ReminderMoved', reminderId: command.reminderId, toSeatId: to.seatId }];
		}
		const from = game.seating
			.map((id) => game.seats[id])
			.find((s) => s.reminders.some((r) => r.reminderId === command.reminderId));
		if (!from) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
		if (from.seatId === to.seatId) {
			warn('no-change', 'the reminder is already on that seat');
			return [];
		}
		const fixed = fixedReminderMove(game, command.reminderId, to.seatId, ctx.characters);
		if (fixed) warn('reminder-fixed', `${fixed.reminder.label} usually stays where it was placed`);
		return [{ type: 'ReminderMoved', reminderId: command.reminderId, toSeatId: to.seatId }];
	},

	RemoveReminder(game, command) {
		const found = reminderHolder(game, command.reminderId) !== undefined;
		if (!found) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
		return [{ type: 'ReminderRemoved', reminderId: command.reminderId }];
	},

	AddRuleReminder(game, command, ctx, warn) {
		const holder = ruleHolderOf(game, ctx, command.characterId);
		const reminder: Reminder = reminderFrom(game, command.reminder);
		const look = startLook(game, reminder, command.tokenId, command.look);
		checkReminder(game, reminder, ctx, warn);
		warnIfNotRuleReminder(reminder, ctx, warn);
		return [
			{
				type: 'RuleReminderAdded',
				characterId: holder,
				reminder: { reminderId: ctx.newId(), ...reminder, ...look }
			}
		];
	},

	MoveReminderToRuleCharacter(game, command, ctx, warn) {
		const holder = ruleHolderOf(game, ctx, command.characterId);
		const from = reminderHolder(game, command.reminderId);
		if (!from) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
		if ('characterId' in from && from.characterId === holder) {
			warn('no-change', 'the reminder is already there');
			return [];
		}
		const reminder = heldReminder(game, from, command.reminderId);
		warnIfNotRuleReminder(reminder, ctx, warn);
		return [
			{
				type: 'ReminderMovedToRuleCharacter',
				reminderId: command.reminderId,
				characterId: holder
			}
		];
	},

	SetReminderNote(game, command, ctx, warn) {
		const from = reminderHolder(game, command.reminderId);
		if (!from) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
		const reminder: ReminderInstance = heldReminder(game, from, command.reminderId);
		const note = command.note?.trim() || undefined;
		if (note === reminder.note) {
			warn('no-change', 'the note is unchanged');
			return [];
		}
		const event: GameEvent = { type: 'ReminderNoteSet', reminderId: command.reminderId };
		if (note !== undefined) event.note = note;
		return [event];
	},

	SetReminderEffect(game, command, ctx, warn) {
		const from = reminderHolder(game, command.reminderId);
		if (!from) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
		const reminder: ReminderInstance = heldReminder(game, from, command.reminderId);
		const { effect } = command;
		if (effect !== undefined) {
			if (!REMINDER_EFFECTS.includes(effect.kind))
				refuse('invalid-effect', `no reminder effect ${String(effect.kind)}`);
			if (!Number.isInteger(effect.night) || effect.night < 1)
				refuse('invalid-effect', 'an effect acts on a night numbered 1 or more');
			const rule = pickedEffectOf(reminder, ctx.characters);
			if (effect.kind !== 'other' && !rule?.effects.includes(effect.kind))
				warn('effect-not-listed', 'this reminder’s rules do not list that effect');
		}
		const same = effect?.kind === reminder.effect?.kind && effect?.night === reminder.effect?.night;
		if (same) {
			warn('no-change', 'the effect is unchanged');
			return [];
		}
		const event: GameEvent = { type: 'ReminderEffectSet', reminderId: command.reminderId };
		if (effect !== undefined) event.effect = { kind: effect.kind, night: effect.night };
		return [event];
	},

	SetReminderMadAs(game, command, ctx, warn) {
		const from = reminderHolder(game, command.reminderId);
		if (!from) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
		const reminder: ReminderInstance = heldReminder(game, from, command.reminderId);
		const { characterId } = command;
		if (characterId !== undefined && !ctx.characters.get(characterId))
			refuse('unknown-character', `no character ${characterId}`);
		const rule = rulesFor(game, reminder.characterId, ctx.characters)?.madAs;
		if (characterId !== undefined && (rule?.mad !== 'carrier' || rule.token !== reminder.label))
			warn('not-mad-as', 'this reminder’s rules do not record a mad-as character');
		if (characterId === reminder.madAs) {
			warn('no-change', 'the character is unchanged');
			return [];
		}
		const event: GameEvent = { type: 'ReminderMadAsSet', reminderId: command.reminderId };
		if (characterId !== undefined) event.characterId = characterId;
		return [event];
	},

	SetReminderSymbol(game, command, ctx, warn) {
		const from = reminderHolder(game, command.reminderId);
		if (!from) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
		const reminder: ReminderInstance = heldReminder(game, from, command.reminderId);
		const symbol = command.symbol?.trim() || undefined;
		if (symbol !== undefined) checkSymbol(symbol);
		if (symbol === reminder.symbol) {
			warn('no-change', 'the symbol is unchanged');
			return [];
		}
		const event: GameEvent = { type: 'ReminderSymbolSet', reminderId: command.reminderId };
		if (symbol !== undefined) event.symbol = symbol;
		return [event];
	},

	SetReminderSymbolColour(game, command, ctx, warn) {
		const from = reminderHolder(game, command.reminderId);
		if (!from) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
		const reminder: ReminderInstance = heldReminder(game, from, command.reminderId);
		const { colour } = command;
		if (colour !== undefined && !isSymbolColour(colour))
			refuse('invalid-colour', `no symbol colour ${colour}`);
		if (colour === reminder.symbolColour) {
			warn('no-change', 'the colour is unchanged');
			return [];
		}
		const event: GameEvent = { type: 'ReminderSymbolColourSet', reminderId: command.reminderId };
		if (colour !== undefined) event.colour = colour;
		return [event];
	},

	SetReminderSymbolFill(game, command, ctx, warn) {
		const from = reminderHolder(game, command.reminderId);
		if (!from) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
		const reminder: ReminderInstance = heldReminder(game, from, command.reminderId);
		if (command.fill === !!reminder.symbolFill) {
			warn('no-change', 'the symbol is unchanged');
			return [];
		}
		const event: GameEvent = { type: 'ReminderSymbolFillSet', reminderId: command.reminderId };
		if (command.fill) event.fill = true;
		return [event];
	},

	SetReminderCountsUp(game, command, ctx, warn) {
		const from = reminderHolder(game, command.reminderId);
		if (!from) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
		const reminder: ReminderInstance = heldReminder(game, from, command.reminderId);
		const { countsUp } = command;
		if (countsUp !== undefined) checkCountsUp(countsUp, reminder.symbol);
		if (countsUp === reminder.countsUp) {
			warn('no-change', 'the token already counts that way');
			return [];
		}
		const event: GameEvent = { type: 'ReminderCountsUpSet', reminderId: command.reminderId };
		if (countsUp !== undefined) event.countsUp = countsUp;
		return [event];
	},

	AdvanceCounters(game, command, ctx, warn) {
		if (!COUNTER_TIMES.includes(command.at)) refuse('invalid-counts-up', `no time ${command.at}`);
		const moves = counterMoves(game, ctx.characters, command.at).filter(
			(m) => !command.numbersOnly || m.kind === 'number'
		);
		if (moves.length === 0) {
			warn('no-change', 'no counting reminders move');
			return [];
		}
		return moves.flatMap((move): GameEvent[] => {
			if (move.kind === 'number')
				return [
					{ type: 'ReminderSymbolSet', reminderId: move.reminderId, symbol: numberSymbol(move.to) }
				];
			const added: GameEvent = {
				type: 'ReminderAdded',
				seatId: move.seatId,
				reminder: { reminderId: ctx.newId(), characterId: move.characterId, label: move.label }
			};
			return move.kind === 'replace'
				? [{ type: 'ReminderRemoved', reminderId: move.reminderId }, added]
				: [added];
		});
	},

	PlaceLooseReminder(game, command, ctx, warn) {
		const reminder: Reminder = reminderFrom(game, command.reminder);
		const look = startLook(game, reminder, command.tokenId, command.look);
		checkReminder(game, reminder, ctx, warn);
		return [
			{ type: 'LooseReminderPlaced', reminder: { reminderId: ctx.newId(), ...reminder, ...look } }
		];
	},

	AddGenericToken(game, command, ctx) {
		return [
			{ type: 'GenericTokenAdded', token: { tokenId: ctx.newId(), ...genericLook(command.look) } }
		];
	},

	SetGenericToken(game, command, ctx, warn) {
		const token = game.genericTokens.find((t) => t.tokenId === command.tokenId);
		if (!token) refuse('unknown-token', `no ∞ token ${command.tokenId}`);
		const look = genericLook(command.look);
		if (
			look.note === token.note &&
			look.symbol === token.symbol &&
			look.symbolColour === token.symbolColour &&
			look.symbolFill === token.symbolFill &&
			look.like?.characterId === token.like?.characterId &&
			look.like?.label === token.like?.label
		) {
			warn('no-change', 'the token is unchanged');
			return [];
		}
		return [{ type: 'GenericTokenSet', token: { tokenId: token.tokenId, ...look } }];
	},

	RemoveGenericToken(game, command) {
		if (!game.genericTokens.some((t) => t.tokenId === command.tokenId))
			refuse('unknown-token', `no ∞ token ${command.tokenId}`);
		return [{ type: 'GenericTokenRemoved', tokenId: command.tokenId }];
	},

	LoosenReminder(game, command, ctx, warn) {
		const from = reminderHolder(game, command.reminderId);
		if (!from) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
		if ('loose' in from) {
			warn('no-change', 'the reminder is already loose');
			return [];
		}
		return [{ type: 'ReminderLoosened', reminderId: command.reminderId }];
	}
};

import { defaultAlignment } from '#lib/core/data/index.ts';
import {
	SYMBOL_COLOURS,
	reminderHolder,
	replacedBy,
	type Reminder,
	type ReminderInstance
} from '#lib/core/model/index.ts';
import { REMINDER_EFFECTS, fixedReminderMove, pickedEffectOf } from '#lib/core/rules/index.ts';
import type { GameEvent } from '../events.ts';
import {
	MAX_REMINDER_SYMBOL,
	checkReminder,
	genericLook,
	heldReminder,
	refuse,
	reminderFrom,
	ruleHolderOf,
	seatOf,
	tokenLook,
	warnIfNotRuleReminder,
	type Deciders
} from './shared.ts';

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
	| 'SetReminderSymbol'
	| 'SetReminderSymbolColour'
	| 'SetReminderSymbolFill'
	| 'PlaceLooseReminder'
	| 'AddGenericToken'
	| 'SetGenericToken'
	| 'RemoveGenericToken'
	| 'LoosenReminder'
> = {
	AddReminder(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		const reminder: Reminder = reminderFrom(game, command.reminder);
		const look = tokenLook(game, command.tokenId);
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
		const look = tokenLook(game, command.tokenId);
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
			if (!pickedEffectOf(reminder, ctx.characters)?.effects.includes(effect.kind))
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

	SetReminderSymbol(game, command, ctx, warn) {
		const from = reminderHolder(game, command.reminderId);
		if (!from) refuse('unknown-reminder', `no reminder ${command.reminderId}`);
		const reminder: ReminderInstance = heldReminder(game, from, command.reminderId);
		const symbol = command.symbol?.trim() || undefined;
		if (symbol !== undefined && symbol.length > MAX_REMINDER_SYMBOL)
			refuse('invalid-symbol', `a symbol is at most ${MAX_REMINDER_SYMBOL} characters`);
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
		if (colour !== undefined && !SYMBOL_COLOURS.includes(colour))
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

	PlaceLooseReminder(game, command, ctx, warn) {
		const reminder: Reminder = reminderFrom(game, command.reminder);
		const look = tokenLook(game, command.tokenId);
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
		const token = game.genericTokens?.find((t) => t.tokenId === command.tokenId);
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
		if (!game.genericTokens?.some((t) => t.tokenId === command.tokenId))
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

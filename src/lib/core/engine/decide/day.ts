import {
	ABNORMAL_REASONS,
	getSeat,
	isTraveller,
	trueCharacter,
	type AbnormalCause,
	type DayEntry,
	type Reminder
} from '#lib/core/model/index.ts';
import { protection } from '#lib/core/rules/index.ts';
import type { GameEvent } from '../events.ts';
import {
	NO_ABILITY_LABEL,
	characterOf,
	checkNomination,
	checkReminder,
	entryOf,
	entryOfKind,
	guessesOf,
	hasPlacedReminder,
	refuse,
	reminderFrom,
	seatOf,
	type Deciders
} from './shared.ts';

/** The day log: nominations, executions, exiles, abilities, notes and night information. */
export const DAY_DECIDERS: Deciders<
	| 'Nominate'
	| 'EditNomination'
	| 'SetDemonVoted'
	| 'SetPrepValue'
	| 'Execute'
	| 'Exile'
	| 'UseAbility'
	| 'DayNote'
	| 'EditDayNote'
	| 'RecordNightInfo'
	| 'RemoveDayEntry'
	| 'NewDay'
> = {
	Nominate(game, command, ctx, warn) {
		const nominator = seatOf(game, command.nominator).seatId;
		const nominee = seatOf(game, command.nominee).seatId;
		checkNomination(game, ctx.characters, nominator, nominee, warn);
		return [
			{
				type: 'DayEntryAdded',
				entry: { kind: 'nomination', entryId: ctx.newId(), nominator, nominee }
			}
		];
	},

	EditNomination(game, command, ctx, warn) {
		const entry = entryOfKind(game, command.entryId, 'nomination');
		const nominator = seatOf(game, command.nominator).seatId;
		const nominee = seatOf(game, command.nominee).seatId;
		if (entry.nominator === nominator && entry.nominee === nominee) {
			warn('no-change', 'the nomination is unchanged');
			return [];
		}
		checkNomination(game, ctx.characters, nominator, nominee, warn, entry.entryId);
		return [{ type: 'DayEntryReplaced', entry: { ...entry, nominator, nominee } }];
	},

	SetDemonVoted(game, command, ctx, warn) {
		if (command.voted === game.today.demonVoted) {
			warn('no-change', 'already marked');
			return [];
		}
		const event: GameEvent = { type: 'DemonVotedSet' };
		if (command.voted !== undefined) event.voted = command.voted;
		return [event];
	},

	SetPrepValue(game, command, ctx, warn) {
		const value = command.value?.trim() || undefined;
		if (!command.key.trim()) refuse('invalid-prep-value', 'a prep value needs a key');
		if (value === game.prepValues?.[command.key]) {
			warn('no-change', 'the value is unchanged');
			return [];
		}
		const event: GameEvent = { type: 'PrepValueSet', key: command.key };
		if (value !== undefined) event.value = value;
		return [event];
	},

	Execute(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		if (game.today.entries.some((e) => e.kind === 'execution')) {
			warn('already-executed', 'there is usually one execution a day');
		}
		if (isTraveller(game, seat.seatId, ctx.characters)) {
			warn('traveller-executed', 'Travellers are exiled, not executed');
		}
		const entry: DayEntry = {
			kind: 'execution',
			entryId: ctx.newId(),
			seatId: seat.seatId,
			died: !seat.dead
		};
		if (seat.dead) {
			warn('already-dead', 'the player was already dead, so the execution is only logged');
			return [{ type: 'DayEntryAdded', entry }];
		}
		const saved =
			command.dies === true
				? undefined
				: protection(game, seat.seatId, ctx.characters, 'execution');
		if (saved) {
			warn('survives-execution', 'the player is executed and does not die');
			const savedBy =
				saved === 'override'
					? {}
					: { characterId: saved.characterId, ...(saved.seatId ? { seatId: saved.seatId } : {}) };
			return [{ type: 'DayEntryAdded', entry: { ...entry, died: false, savedBy } }];
		}
		return [
			{ type: 'DayEntryAdded', entry },
			{ type: 'DeathSet', seatId: seat.seatId, dead: true, cause: 'execution' }
		];
	},

	Exile(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		if (!isTraveller(game, seat.seatId, ctx.characters)) {
			warn('not-traveller', 'only Travellers are exiled');
		}
		const entry: DayEntry = {
			kind: 'exile',
			entryId: ctx.newId(),
			seatId: seat.seatId,
			died: !seat.dead
		};
		if (seat.dead) {
			warn('already-dead', 'the player was already dead, so the exile is only logged');
			return [{ type: 'DayEntryAdded', entry }];
		}
		return [
			{ type: 'DayEntryAdded', entry },
			{ type: 'DeathSet', seatId: seat.seatId, dead: true, cause: 'exile' }
		];
	},

	UseAbility(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		const character = characterOf(ctx, command.characterId);
		const truly = trueCharacter(game, seat.seatId, ctx.characters);
		if (seat.characterId !== character.id && truly !== character.id) {
			warn('not-seat-character', `this seat is not the ${character.name}`);
		}
		const entry: Extract<DayEntry, { kind: 'ability' }> = {
			kind: 'ability',
			entryId: ctx.newId(),
			seatId: seat.seatId,
			characterId: character.id
		};
		const usedToday = game.today.entries.some(
			(e) => e.kind === 'ability' && e.seatId === seat.seatId && e.characterId === character.id
		);
		if (!character.reminders.includes(NO_ABILITY_LABEL)) {
			if (usedToday) warn('already-used', `the ${character.name} already used it today`);
			return [{ type: 'DayEntryAdded', entry }];
		}
		const placed = seat.reminders.some(
			(r) => r.characterId === character.id && r.label === NO_ABILITY_LABEL
		);
		if (placed) {
			warn('already-used', `the ${character.name} already has "${NO_ABILITY_LABEL}"`);
			return [{ type: 'DayEntryAdded', entry }];
		}
		const reminderId = ctx.newId();
		return [
			{
				type: 'ReminderAdded',
				seatId: seat.seatId,
				reminder: { reminderId, characterId: character.id, label: NO_ABILITY_LABEL }
			},
			{ type: 'DayEntryAdded', entry: { ...entry, reminderId } }
		];
	},

	DayNote(game, command, ctx, warn) {
		const characterId = characterOf(ctx, command.characterId).id;
		const guesses = guessesOf(game, ctx, command.guesses);
		const text = typeof command.text === 'string' ? command.text : '';
		if (text.trim() === '' && guesses.length === 0) {
			warn('no-change', 'the note is empty');
			return [];
		}
		const entry: DayEntry = { kind: 'note', entryId: ctx.newId(), characterId, text };
		if (command.seatId !== undefined) entry.seatId = seatOf(game, command.seatId).seatId;
		if (guesses.length > 0) entry.guesses = guesses;
		if (typeof command.holds === 'boolean') entry.holds = command.holds;
		return [{ type: 'DayEntryAdded', entry }];
	},

	EditDayNote(game, command, ctx, warn) {
		const entry = entryOfKind(game, command.entryId, 'note');
		const guesses = guessesOf(game, ctx, command.guesses);
		const text = typeof command.text === 'string' ? command.text : '';
		// Clearing a note removes it: nothing requires a note.
		if (text.trim() === '' && guesses.length === 0) {
			return [{ type: 'DayEntryRemoved', entryId: entry.entryId }];
		}
		const next: Extract<DayEntry, { kind: 'note' }> = { ...entry, text };
		delete next.guesses;
		delete next.holds;
		if (guesses.length > 0) next.guesses = guesses;
		if (typeof command.holds === 'boolean') next.holds = command.holds;
		if (JSON.stringify(next) === JSON.stringify(entry)) {
			warn('no-change', 'the note is unchanged');
			return [];
		}
		return [{ type: 'DayEntryReplaced', entry: next }];
	},

	RecordNightInfo(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		const characterId = characterOf(ctx, command.characterId).id;
		const text = typeof command.text === 'string' ? command.text.trim() : '';
		const placements = (command.reminders ?? []).map((p) => {
			const target = seatOf(game, p.seatId);
			const reminder: Reminder = reminderFrom(game, p.reminder);
			checkReminder(game, reminder, ctx, warn);
			return { seatId: target.seatId, reminder: { reminderId: ctx.newId(), ...reminder } };
		});
		const abnormal = (command.abnormal ?? []).map((cause): AbnormalCause => {
			if (!(ABNORMAL_REASONS as readonly string[]).includes(cause.reason)) {
				refuse('invalid-abnormal', `unknown abnormal reason ${String(cause.reason)}`);
			}
			return {
				reason: cause.reason,
				...(cause.characterId !== undefined
					? { characterId: characterOf(ctx, cause.characterId).id }
					: {}),
				...(cause.seatId !== undefined ? { seatId: seatOf(game, cause.seatId).seatId } : {})
			};
		});
		if (text === '' && placements.length === 0) {
			warn('no-change', 'nothing to record');
			return [];
		}
		return [
			...placements.map((p): GameEvent => ({ type: 'ReminderAdded', ...p })),
			{
				type: 'DayEntryAdded',
				entry: {
					kind: 'info',
					entryId: ctx.newId(),
					seatId: seat.seatId,
					characterId,
					text,
					reminderIds: placements.map((p) => p.reminder.reminderId),
					...(abnormal.length > 0 ? { abnormal } : {})
				}
			}
		];
	},

	RemoveDayEntry(game, command) {
		const entry = entryOf(game, command.entryId);
		const events: GameEvent[] = [];
		if ((entry.kind === 'execution' || entry.kind === 'exile') && entry.died) {
			const seat = getSeat(game, entry.seatId);
			if (seat?.dead && seat.deathCause === entry.kind) {
				events.push({ type: 'DeathSet', seatId: seat.seatId, dead: false });
				if (seat.ghostVoteUsed) events.push({ type: 'GhostVoteRestored', seatId: seat.seatId });
			}
		}
		const placed =
			entry.kind === 'info'
				? entry.reminderIds
				: entry.kind === 'ability' && entry.reminderId !== undefined
					? [entry.reminderId]
					: [];
		for (const reminderId of placed) {
			if (hasPlacedReminder(game, reminderId)) events.push({ type: 'ReminderRemoved', reminderId });
		}
		events.push({ type: 'DayEntryRemoved', entryId: entry.entryId });
		return events;
	},

	NewDay(game, command, ctx, warn) {
		if (game.today.entries.length === 0 && game.today.demonVoted === undefined) {
			warn('empty-day', 'nothing was logged since the last new day');
		}
		return [{ type: 'DayStarted', at: ctx.now() }];
	}
};

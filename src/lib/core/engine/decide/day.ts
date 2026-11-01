import {
	ABNORMAL_REASONS,
	GUESS_ANSWERS,
	getSeat,
	isTraveller,
	trueCharacter,
	typeOf,
	type AbnormalCause,
	type DayEntry,
	type Game,
	type GuessAnswer,
	type Reminder
} from '#lib/core/model/index.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import {
	DAY_MARKS,
	dayMarkSeats,
	dayMarkValue,
	markTokenSwap,
	marksInPlay,
	executionSavers,
	exileSavers,
	protection,
	type DayMark
} from '#lib/core/rules/index.ts';
import type { EngineContext } from '../context.ts';
import type { GameEvent } from '../events.ts';
import {
	NO_ABILITY_LABEL,
	characterOf,
	checkGuessLimit,
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

/** One of the Storyteller's answers to an ability guess; anything else is left out. */
const isAnswer = (value: unknown): value is GuessAnswer =>
	(GUESS_ANSWERS as readonly unknown[]).includes(value);

/** Sets a note's answer: one of the standard ones, else the Storyteller's own words. */
function answerNote(
	note: Extract<DayEntry, { kind: 'note' }>,
	command: { answer?: unknown; customAnswer?: unknown }
) {
	if (isAnswer(command.answer)) note.answer = command.answer;
	else if (typeof command.customAnswer === 'string' && command.customAnswer.trim())
		note.customAnswer = command.customAnswer.trim();
}

/** The day log: nominations, executions, exiles, abilities, notes and night information. */
export const DAY_DECIDERS: Deciders<
	| 'Nominate'
	| 'EditNomination'
	| 'ChooseForNomination'
	| 'SetDayMark'
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
		const events: GameEvent[] = [
			{
				type: 'DayEntryAdded',
				entry: { kind: 'nomination', entryId: ctx.newId(), nominator, nominee }
			}
		];
		// A Minion's recorded nomination marks it for the Town Crier, tokens and all (Trevor,
		// 2026-10-24: use the nominations recorded; https://wiki.bloodontheclocktower.com/Town_Crier).
		const mark = 'minion-nominated';
		if (
			dayMarkValue(game, mark) !== true &&
			dayMarkSeats(game, ctx.characters, mark).length > 0 &&
			typeOf(game, nominator, ctx.characters) === 'minion'
		) {
			events.push(...markEvents(game, mark, true, ctx));
		}
		return events;
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
		// Whom the nominee chose was the old nominee's choice: a new nominee chooses again.
		const next: typeof entry = { ...entry, nominator, nominee };
		if (nominee !== entry.nominee) delete next.chosen;
		return [{ type: 'DayEntryReplaced', entry: next }];
	},

	ChooseForNomination(game, command, ctx, warn) {
		const entry = entryOfKind(game, command.entryId, 'nomination');
		const chosen = command.chosen === undefined ? undefined : seatOf(game, command.chosen).seatId;
		if (entry.chosen === chosen) {
			warn('no-change', 'the choice is unchanged');
			return [];
		}
		const next: typeof entry = { ...entry };
		if (chosen) next.chosen = chosen;
		else delete next.chosen;
		return [{ type: 'DayEntryReplaced', entry: next }];
	},

	SetDayMark(game, command, ctx, warn) {
		if (!(DAY_MARKS as readonly string[]).includes(command.mark)) {
			refuse('invalid-day-mark', `unknown day mark ${String(command.mark)}`);
		}
		if (command.value === dayMarkValue(game, command.mark)) {
			warn('no-change', 'already marked');
			return [];
		}
		return markEvents(game, command.mark, command.value, ctx);
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
		// The Storyteller's own pick of what saved them (the Pacifist), applied even when the
		// grimoire says it should not (warn, never lock).
		const chosen =
			command.savedBy === undefined
				? undefined
				: executionSavers(game, seat.seatId, ctx.characters).find(
						(s) => s.source.characterId === command.savedBy
					);
		if (command.savedBy !== undefined && (!chosen || chosen.problem)) {
			warn('save-may-not-apply', 'that character may not save this player from execution');
		}
		const saved =
			command.dies === true
				? undefined
				: command.savedBy !== undefined
					? (chosen?.source ?? { characterId: command.savedBy })
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
			{ type: 'DeathSet', seatId: seat.seatId, dead: true, cause: command.cause ?? 'execution' }
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
		// As an execution: a protection that stops any death (the Tea Lady's) applies, and the
		// Storyteller's own pick (the Deviant they found funny) is applied as given.
		const chosen =
			command.savedBy === undefined
				? undefined
				: exileSavers(game, seat.seatId, ctx.characters).find(
						(s) => s.source.characterId === command.savedBy
					);
		if (command.savedBy !== undefined && (!chosen || chosen.problem)) {
			warn('save-may-not-apply', 'that character may not save this player from exile');
		}
		const saved =
			command.dies === true
				? undefined
				: command.savedBy !== undefined
					? (chosen?.source ?? { characterId: command.savedBy })
					: protection(game, seat.seatId, ctx.characters, 'exile');
		if (saved) {
			warn('survives-exile', 'the player is exiled and does not die');
			const savedBy =
				saved === 'override'
					? {}
					: { characterId: saved.characterId, ...(saved.seatId ? { seatId: saved.seatId } : {}) };
			return [{ type: 'DayEntryAdded', entry: { ...entry, died: false, savedBy } }];
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
		if (command.on !== undefined) entry.on = seatOf(game, command.on).seatId;
		const usedToday = game.today.entries.some(
			(e) => e.kind === 'ability' && e.seatId === seat.seatId && e.characterId === character.id
		);
		// The token that marks it spent: "No Ability", or its own (the Golem's May Not Nominate).
		const spent = rulesOf(character.id, ctx.characters)?.dayUse?.spentToken ?? NO_ABILITY_LABEL;
		if (!character.reminders.includes(spent)) {
			if (usedToday) warn('already-used', `the ${character.name} already used it today`);
			return [{ type: 'DayEntryAdded', entry }];
		}
		const placed = seat.reminders.some((r) => r.characterId === character.id && r.label === spent);
		if (placed) {
			warn('already-used', `the ${character.name} already has "${spent}"`);
			return [{ type: 'DayEntryAdded', entry }];
		}
		const reminderId = ctx.newId();
		return [
			{
				type: 'ReminderAdded',
				seatId: seat.seatId,
				reminder: { reminderId, characterId: character.id, label: spent }
			},
			{ type: 'DayEntryAdded', entry: { ...entry, reminderId } }
		];
	},

	DayNote(game, command, ctx, warn) {
		const characterId = characterOf(ctx, command.characterId).id;
		const guesses = guessesOf(game, ctx, command.guesses);
		checkGuessLimit(ctx, characterId, guesses.length, warn);
		const text = typeof command.text === 'string' ? command.text : '';
		if (text.trim() === '' && guesses.length === 0) {
			warn('no-change', 'the note is empty');
			return [];
		}
		const entry: Extract<DayEntry, { kind: 'note' }> = {
			kind: 'note',
			entryId: ctx.newId(),
			characterId,
			text
		};
		if (command.seatId !== undefined) entry.seatId = seatOf(game, command.seatId).seatId;
		if (guesses.length > 0) entry.guesses = guesses;
		if (typeof command.holds === 'boolean') entry.holds = command.holds;
		answerNote(entry, command);
		return [{ type: 'DayEntryAdded', entry }];
	},

	EditDayNote(game, command, ctx, warn) {
		const entry = entryOfKind(game, command.entryId, 'note');
		const guesses = guessesOf(game, ctx, command.guesses);
		checkGuessLimit(ctx, entry.characterId, guesses.length, warn);
		const text = typeof command.text === 'string' ? command.text : '';
		// Clearing a note removes it: nothing requires a note.
		if (text.trim() === '' && guesses.length === 0) {
			return [{ type: 'DayEntryRemoved', entryId: entry.entryId }];
		}
		const next: Extract<DayEntry, { kind: 'note' }> = { ...entry, text };
		delete next.guesses;
		delete next.holds;
		delete next.answer;
		delete next.customAnswer;
		if (guesses.length > 0) next.guesses = guesses;
		if (typeof command.holds === 'boolean') next.holds = command.holds;
		answerNote(next, command);
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
		if (game.today.entries.length === 0 && game.today.marks === undefined) {
			warn('empty-day', 'nothing was logged since the last new day');
		}
		// Each dawn the "no" token goes on and the "yes" one comes off; the mark itself stays
		// unset until the Storyteller marks it (wiki How to Run:
		// https://wiki.bloodontheclocktower.com/Flowergirl, /Town_Crier).
		const tokens = marksInPlay(game, ctx.characters).flatMap((mark) =>
			tokenEvents(game, mark, false, ctx)
		);
		return [{ type: 'DayStarted', at: ctx.now() }, ...tokens];
	}
};

/** Marks one of today's facts and swaps the tokens that show it. */
function markEvents(
	game: Game,
	mark: DayMark,
	value: boolean | undefined,
	ctx: EngineContext
): GameEvent[] {
	const event: GameEvent = { type: 'DayMarkSet', mark };
	if (value !== undefined) event.value = value;
	return [event, ...tokenEvents(game, mark, value, ctx)];
}

/** The token swap on each seat that shows `mark` as `value`. */
function tokenEvents(
	game: Game,
	mark: DayMark,
	value: boolean | undefined,
	ctx: EngineContext
): GameEvent[] {
	const swap = markTokenSwap(game, mark, value, ctx.characters);
	return [
		...swap.remove.map((reminderId): GameEvent => ({ type: 'ReminderRemoved', reminderId })),
		...swap.add.map((p): GameEvent => ({
			type: 'ReminderAdded',
			seatId: p.seatId,
			reminder: { reminderId: ctx.newId(), characterId: p.characterId, label: p.label }
		}))
	];
}

/**
 * The grimoire's History: each entry of the engine's log as a short line of words and
 * badges, newest first, worked out from the events it recorded and the game just before
 * and after it. UI wording only; the log itself is the engine's.
 */
import type { Alignment, CharacterId, ReminderLabel } from '#lib/core/data/index.ts';
import { applyEvents, type GameEvent, type LogEntry } from '#lib/core/engine/index.ts';
import type { CharacterLookup, DeathCause, Game, SeatId } from '#lib/core/model/index.ts';
import { describeEntry as describeDayEntry } from '#lib/features/day/day-port.ts';
import { slot, splitSlots } from '#lib/features/characters/slots.ts';
import { causeCharacter, causeLabel } from './board.ts';

export type HistoryPart =
	| { kind: 'text'; text: string }
	/** A seat as it was at the time: its character as a badge, or its name. */
	| { kind: 'seat'; name: string; characterId?: CharacterId; alignment?: Alignment }
	| { kind: 'character'; characterId: CharacterId }
	| { kind: 'reminder'; label: ReminderLabel; characterId: CharacterId };

export interface HistoryItem {
	/** How many log entries are applied once this one is (the cursor just after it). */
	cursor: number;
	at: number;
	parts: HistoryPart[];
	/** Undone: after the cursor, kept until a new change replaces it. */
	undone: boolean;
}

const text = (t: string): HistoryPart => ({ kind: 'text', text: t });

function seatPart(game: Game | undefined, seatId: SeatId): HistoryPart {
	const seat = game?.seats[seatId];
	const number = (game?.seating.indexOf(seatId) ?? -1) + 1;
	const name = seat?.playerName ?? (number > 0 ? `Seat ${number}` : 'A seat');
	return seat?.characterId
		? { kind: 'seat', name, characterId: seat.characterId, alignment: seat.alignment }
		: { kind: 'seat', name };
}

/** A seat by its name only, for lines where its character is the news. */
function seatName(game: Game | undefined, seatId: SeatId): HistoryPart {
	const part = seatPart(game, seatId);
	return part.kind === 'seat' ? text(part.name) : part;
}

function reminderOn(
	game: Game | undefined,
	reminderId: string
): { seatId: SeatId; label: ReminderLabel; characterId: CharacterId } | undefined {
	for (const seatId of game?.seating ?? []) {
		const r = game!.seats[seatId].reminders.find((x) => x.reminderId === reminderId);
		if (r) return { seatId, label: r.label, characterId: r.characterId };
	}
	return undefined;
}

/** A cause as words, or the killing character as a badge. */
function causeParts(
	cause: DeathCause,
	characters: CharacterLookup,
	traveller: boolean
): HistoryPart[] {
	const characterId = causeCharacter(cause);
	return characterId
		? [{ kind: 'character', characterId }]
		: [text(causeLabel(cause, characters, traveller))];
}

/** One event as words and badges, using the game just before and just after it. */
function describeEvent(
	event: GameEvent,
	before: Game | undefined,
	after: Game,
	characters: CharacterLookup
): HistoryPart[] {
	switch (event.type) {
		case 'GameCreated':
			return [
				text(`New game: ${event.script.meta?.name || 'None'}, ${event.seatIds.length} seats`)
			];
		case 'ScriptChanged':
			return [text(`Script changed to ${event.script.meta?.name ?? 'a custom script'}`)];
		case 'SeatAdded':
			return [text('Added '), seatName(after, event.seatId)];
		case 'SeatRemoved':
			return [text('Removed '), seatPart(before, event.seatId)];
		case 'SeatRenamed':
			return event.playerName
				? [seatName(before, event.seatId), text(` renamed ${event.playerName}`)]
				: [text('Cleared the name of '), seatName(before, event.seatId)];
		case 'CharacterAssigned':
			return [
				seatName(after, event.seatId),
				text(' is '),
				{ kind: 'character', characterId: event.characterId }
			];
		case 'CharacterCleared':
			return [text('Removed the character from '), seatPart(before, event.seatId)];
		case 'AlignmentSet':
			return [seatPart(before, event.seatId), text(` is now ${event.alignment}`)];
		case 'DeathSet': {
			const traveller =
				characters.get(before?.seats[event.seatId]?.characterId ?? '')?.type === 'traveller';
			return event.dead
				? [
						seatPart(before, event.seatId),
						...(event.cause === undefined
							? [text(' died')]
							: [text(' died ('), ...causeParts(event.cause, characters, traveller), text(')')])
					]
				: [seatPart(before, event.seatId), text(' is alive again')];
		}
		case 'DeathCauseSet': {
			const traveller =
				characters.get(before?.seats[event.seatId]?.characterId ?? '')?.type === 'traveller';
			return [
				seatPart(before, event.seatId),
				text(': cause of death '),
				...(event.cause === undefined
					? [text(causeLabel(undefined, characters, traveller))]
					: causeParts(event.cause, characters, traveller))
			];
		}
		case 'GhostVoteSpent':
			return [seatPart(before, event.seatId), text(' used their ghost vote')];
		case 'GhostVoteRestored':
			return [seatPart(before, event.seatId), text(' has their ghost vote again')];
		case 'ReminderAdded':
			return [
				{ kind: 'reminder', label: event.reminder.label, characterId: event.reminder.characterId },
				text(' on '),
				seatPart(before, event.seatId)
			];
		case 'ReminderMoved': {
			const r = reminderOn(before, event.reminderId);
			return r
				? [
						{ kind: 'reminder', label: r.label, characterId: r.characterId },
						text(' moved from '),
						seatPart(before, r.seatId),
						text(' to '),
						seatPart(before, event.toSeatId)
					]
				: [text('Moved a reminder')];
		}
		case 'ReminderRemoved': {
			const r = reminderOn(before, event.reminderId);
			return r
				? [
						text('Removed '),
						{ kind: 'reminder', label: r.label, characterId: r.characterId },
						text(' from '),
						seatPart(before, r.seatId)
					]
				: [text('Removed a reminder')];
		}
		case 'SeatNoteSet':
			return event.note
				? [text('Note on '), seatPart(before, event.seatId)]
				: [text('Cleared the note on '), seatPart(before, event.seatId)];
		case 'SeatsSwapped':
			return [
				text('Swapped '),
				seatPart(before, event.seatA),
				text(' and '),
				seatPart(before, event.seatB)
			];
		case 'SeatingReordered':
			return [text('Changed the seating order')];
		case 'OverrideSet':
		case 'OverrideCleared':
			return [text('Changed an override on '), seatPart(before, event.seatId)];
		case 'RuleCharacterAdded':
			return [text('Added '), { kind: 'character', characterId: event.characterId }];
		case 'RuleCharacterRemoved':
			return [text('Removed '), { kind: 'character', characterId: event.characterId }];
		case 'BluffsSet':
		case 'BluffSetRemoved':
		case 'BluffSetRenamed':
			return [text('Changed the Demon bluffs')];
		case 'BagBuilt':
			return [text('Filled the bag')];
		case 'BagCleared':
			return [text('Emptied the bag')];
		case 'TileDrawn':
			return [seatName(before, event.seatId), text(' drew a token')];
		case 'DrawConfirmed':
			return [text('Confirmed a draw')];
		case 'DrawCancelled':
			return [text('Put a drawn token back')];
		case 'NightStepOverrideAdded':
		case 'NightStepOverrideReplaced':
		case 'NightStepOverrideRemoved':
			return [text('Changed the night order')];
		case 'DayReminderOverrideAdded':
		case 'DayReminderOverrideReplaced':
		case 'DayReminderOverrideRemoved':
			return [text('Changed the day reminders')];
		case 'DayStarted':
			return [text('Started the day')];
		case 'PrepValueSet':
			return [text('Changed the setup notes')];
		case 'DayEntryAdded':
		case 'DayEntryReplaced': {
			const name = (seatId: SeatId | undefined) => {
				if (seatId === undefined) return 'None';
				const part = seatName(after, seatId);
				return part.kind === 'text' ? part.text : 'A seat';
			};
			// Characters go in as slots and come back out as badges.
			const ids: CharacterId[] = [];
			const line = describeDayEntry(event.entry, name, (id) => {
				if (!id) return 'None';
				ids.push(id);
				return slot(`c${ids.length - 1}`);
			});
			const parts = splitSlots(line).map((part, i): HistoryPart =>
				i % 2 === 1 ? { kind: 'character', characterId: ids[Number(part.slice(1))] } : text(part)
			);
			return event.type === 'DayEntryReplaced' ? [text('Changed: '), ...parts] : parts;
		}
		case 'DayEntryRemoved':
			return [text('Removed from the day log')];
		case 'DemonVotedSet':
			return [
				text(
					event.voted === undefined
						? 'Cleared Demon voted'
						: event.voted
							? 'Demon voted'
							: 'Demon did not vote'
				)
			];
		default:
			return [text('Changed the day log')];
	}
}

/** One log entry's line: its first event, or a count when it placed several reminders. */
export function describeEntry(
	entry: LogEntry,
	before: Game | undefined,
	after: Game,
	characters: CharacterLookup
): HistoryPart[] {
	const [first] = entry.events;
	if (!first) return [text('No change')];
	if (first.type === 'SeatingReordered' && before) {
		const was = before.seating;
		const now = first.seating;
		if (entry.command === 'RotateSeats' && now.length > 1)
			return [text(`Rotated the seats ${now[1] === was[0] ? 'clockwise' : 'anticlockwise'}`)];
		// MoveSeat: the one seat whose removal leaves the same order.
		const moved = now.find((id) => {
			const a = was.filter((x) => x !== id);
			const b = now.filter((x) => x !== id);
			return was.indexOf(id) !== now.indexOf(id) && a.every((x, i) => x === b[i]);
		});
		if (moved) return [seatPart(before, moved), text(` moved to seat ${now.indexOf(moved) + 1}`)];
	}
	if (entry.events.length > 1 && entry.events.every((e) => e.type === 'ReminderAdded')) {
		return [text(`Placed ${entry.events.length} reminders`)];
	}
	return describeEvent(first, before, after, characters);
}

/** The whole log as History lines, newest first; undone entries are marked. */
export function historyItems(
	entries: readonly LogEntry[],
	cursor: number,
	characters: CharacterLookup
): HistoryItem[] {
	const items: HistoryItem[] = [];
	let game: Game | undefined;
	entries.forEach((entry, i) => {
		const before = game;
		game = applyEvents(game, entry.events);
		if (!game) return;
		items.push({
			cursor: i + 1,
			at: entry.at,
			parts: describeEntry(entry, before, game, characters),
			undone: i + 1 > cursor
		});
	});
	return items.reverse();
}

/** One change to who a seat is during the game, for the seat sheet (Trevor, 2026-10-16). */
export type SeatChange =
	| { kind: 'character'; at: number; from: CharacterId; to: CharacterId }
	| { kind: 'alignment'; at: number; from: Alignment; to: Alignment };

/**
 * A seat's character and alignment changes, oldest first, from the applied log entries: a
 * Fang Gu jumping into an Outsider, a Snake Charmer swap, a Pit-Hag, a turned alignment.
 * The first character a seat gets is not a change; a character removed and later replaced
 * counts as one change from the old character to the new.
 */
export function seatChanges(
	entries: readonly LogEntry[],
	cursor: number,
	seatId: SeatId
): SeatChange[] {
	const out: SeatChange[] = [];
	let character: CharacterId | undefined;
	let alignment: Alignment | undefined;
	const turn = (at: number, to: Alignment | undefined) => {
		if (alignment !== undefined && to !== undefined && to !== alignment)
			out.push({ kind: 'alignment', at, from: alignment, to });
		if (to !== undefined) alignment = to;
	};
	for (const entry of entries.slice(0, cursor)) {
		for (const event of entry.events) {
			if (!('seatId' in event) || event.seatId !== seatId) continue;
			if (event.type === 'CharacterAssigned') {
				if (character !== undefined && character !== event.characterId)
					out.push({ kind: 'character', at: entry.at, from: character, to: event.characterId });
				character = event.characterId;
				turn(entry.at, event.alignment);
			} else if (event.type === 'AlignmentSet') {
				turn(entry.at, event.alignment);
			} else if (event.type === 'SeatRemoved') {
				return [];
			}
		}
	}
	return out;
}

/** The characters an entry names: a seat's character, a reminder's source or a change. */
export function itemCharacters(item: HistoryItem): CharacterId[] {
	return [
		...new Set(
			item.parts.flatMap((p) => ('characterId' in p && p.characterId ? [p.characterId] : []))
		)
	];
}

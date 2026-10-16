/**
 * The grimoire's History: each entry of the engine's log as a short line of words and
 * badges, newest first, worked out from the events it recorded and the game just before
 * and after it. UI wording only; the log itself is the engine's.
 */
import type { Alignment, CharacterId } from '#lib/core/data/index.ts';
import { applyEvents, type GameEvent, type LogEntry } from '#lib/core/engine/index.ts';
import type { CharacterLookup, DeathCause, Game, SeatId } from '#lib/core/model/index.ts';
import { causeLabel } from './board.ts';

export type HistoryPart =
	| { kind: 'text'; text: string }
	/** A seat as it was at the time: its character as a badge, or its name. */
	| { kind: 'seat'; name: string; characterId?: CharacterId; alignment?: Alignment }
	| { kind: 'character'; characterId: CharacterId }
	| { kind: 'reminder'; label: string; characterId: CharacterId };

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
): { seatId: SeatId; label: string; characterId: CharacterId } | undefined {
	for (const seatId of game?.seating ?? []) {
		const r = game!.seats[seatId].reminders.find((x) => x.reminderId === reminderId);
		if (r) return { seatId, label: r.label, characterId: r.characterId };
	}
	return undefined;
}

function deathText(cause: DeathCause | undefined, characters: CharacterLookup, traveller: boolean) {
	return cause === undefined ? '' : ` (${causeLabel(cause, characters, traveller)})`;
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
				text(
					`New game: ${event.script.meta?.name ?? 'Custom script'}, ${event.seatIds.length} seats`
				)
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
						text(` died${deathText(event.cause, characters, traveller)}`)
					]
				: [seatPart(before, event.seatId), text(' is alive again')];
		}
		case 'DeathCauseSet': {
			const traveller =
				characters.get(before?.seats[event.seatId]?.characterId ?? '')?.type === 'traveller';
			return [
				seatPart(before, event.seatId),
				text(`: cause of death ${causeLabel(event.cause, characters, traveller)}`)
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
						text(' moved to '),
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
		case 'SeatsSwapped':
			return [
				text('Swapped '),
				seatPart(before, event.seatA),
				text(' and '),
				seatPart(before, event.seatB)
			];
		case 'OverrideSet':
		case 'OverrideCleared':
			return [text('Changed an override on '), seatPart(before, event.seatId)];
		case 'RuleCharacterAdded':
			return [text('Added '), { kind: 'character', characterId: event.characterId }];
		case 'RuleCharacterRemoved':
			return [text('Removed '), { kind: 'character', characterId: event.characterId }];
		case 'BluffsSet':
		case 'BluffSetRemoved':
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

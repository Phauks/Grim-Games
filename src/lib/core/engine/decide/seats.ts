import type { Game, GameNote, SeatId } from '#lib/core/model/index.ts';
import { neighbourFollows } from '#lib/core/rules/reminder-movement.ts';
import type { EngineContext } from '../context.ts';
import type { GameEvent } from '../events.ts';
import {
	MAX_SEATS,
	nextPosition,
	offScript,
	refuse,
	seatNumberNames,
	seatOf,
	type Deciders,
	type Warn
} from './shared.ts';

/**
 * The note a `SetGameNote` or `SetSeatNote` writes into `notes`, trimmed, or undefined when
 * nothing changes: a new note with nothing in it is not kept. A new note takes the next
 * free `n<number>` id.
 */
function writtenNote(
	notes: readonly GameNote[] = [],
	command: { noteId?: string; title: string; text: string; hidden: boolean },
	warn: Warn
): GameNote | undefined {
	const before = command.noteId
		? (notes.find((n) => n.noteId === command.noteId) ??
			refuse('unknown-note', `no note ${command.noteId}`))
		: undefined;
	const title = command.title.trim();
	const text = command.text.trim();
	if (!before && !title && !text) {
		warn('no-change', 'a new note with nothing in it is not kept');
		return undefined;
	}
	if (
		before &&
		before.title === title &&
		before.text === text &&
		before.hidden === command.hidden
	) {
		warn('no-change', 'the note is unchanged');
		return undefined;
	}
	const noteId =
		before?.noteId ??
		`n${notes.reduce((max, n) => Math.max(max, Number(n.noteId.slice(1)) || 0), 0) + 1}`;
	return { noteId, title, text, hidden: command.hidden };
}

/**
 * The events that put the players in `seating`: the new order, then each token that follows
 * its character's neighbours (the Tea Lady's, the No Dashii's) moving to the new neighbour,
 * with a note saying so.
 */
function reseated(
	game: Game,
	seating: SeatId[],
	reorder: GameEvent,
	ctx: EngineContext,
	warn: Warn
): GameEvent[] {
	const name = (id: SeatId) => game.seats[id].playerName ?? `Seat ${game.seating.indexOf(id) + 1}`;
	const follows = neighbourFollows(game, { ...game, seating }, ctx.characters);
	for (const f of follows) {
		const character = ctx.characters.get(f.reminder.characterId)?.name ?? f.reminder.characterId;
		warn(
			'reminder-followed',
			`${character}’s ${f.reminder.label} moved from ${name(f.fromSeatId)} to ${name(f.toSeatId)}, the new neighbour.`
		);
	}
	return [
		reorder,
		...follows.map((f): GameEvent => ({
			type: 'ReminderMoved',
			reminderId: f.reminderId,
			toSeatId: f.toSeatId
		}))
	];
}

/** Seats, the script, the Storyteller name and game notes. */
export const SEATS_DECIDERS: Deciders<
	| 'ChangeScript'
	| 'AddSeat'
	| 'RemoveSeat'
	| 'RenameSeat'
	| 'SetStorytellerName'
	| 'SetSeatNote'
	| 'DeleteSeatNote'
	| 'SetSeatLook'
	| 'SetGameNote'
	| 'DeleteGameNote'
	| 'SwapSeats'
	| 'RotateSeats'
	| 'MoveSeat'
> = {
	ChangeScript(game, command, ctx, warn) {
		if (JSON.stringify(command.script) === JSON.stringify(game.script)) {
			warn('no-change', 'that is already the script');
			return [];
		}
		for (const id of offScript(game, command.script, ctx)) {
			const name = ctx.characters.get(id)?.name ?? id;
			warn('not-on-script', `${name} is not on the script`, [id]);
		}
		return [{ type: 'ScriptChanged', script: command.script }];
	},

	AddSeat(game, command, ctx) {
		const position = command.position ?? game.seating.length;
		if (!Number.isInteger(position) || position < 0 || position > game.seating.length) {
			refuse('invalid-position', `position must be from 0 to ${game.seating.length}`);
		}
		if (game.seating.length >= MAX_SEATS) {
			refuse('invalid-player-count', `a game has at most ${MAX_SEATS} seats`);
		}
		const playerName = command.playerName?.trim() || undefined;
		const event: GameEvent = { type: 'SeatAdded', seatId: ctx.newId(), position };
		if (playerName !== undefined) event.playerName = playerName;
		return [event];
	},

	RemoveSeat(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		const events: GameEvent[] = [];
		if (seat.characterId !== undefined) {
			warn('seat-has-character', 'the removed seat had a character');
		}
		for (const tile of Object.values(game.bag?.tiles ?? {})) {
			if (tile.drawnBySeat === seat.seatId && !tile.confirmed) {
				warn('draw-cancelled', 'the tile this player was holding went back in the bag');
				events.push({
					type: 'DrawCancelled',
					tileId: tile.tileId,
					position: nextPosition(game.bag!.order.length, ctx)
				});
			}
		}
		events.push({ type: 'SeatRemoved', seatId: seat.seatId });
		return events;
	},

	RenameSeat(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		const playerName = command.playerName?.trim() || undefined;
		if (playerName === seat.playerName) {
			warn('no-change', 'the name is unchanged');
			return [];
		}
		const event: GameEvent = { type: 'SeatRenamed', seatId: seat.seatId };
		if (playerName !== undefined) event.playerName = playerName;
		return [event];
	},

	SetStorytellerName(game, command, ctx, warn) {
		const name = command.name?.trim() || undefined;
		if (name === game.storytellerName) {
			warn('no-change', 'the name is unchanged');
			return [];
		}
		const event: GameEvent = { type: 'StorytellerNameSet' };
		if (name !== undefined) event.name = name;
		return [event];
	},

	SetSeatNote(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		const note = writtenNote(seat.notes, command, warn);
		return note ? [{ type: 'SeatNoteSaved', seatId: seat.seatId, note }] : [];
	},

	DeleteSeatNote(game, command) {
		const seat = seatOf(game, command.seatId);
		if (!seat.notes?.some((n) => n.noteId === command.noteId))
			refuse('unknown-note', `no note ${command.noteId}`);
		return [{ type: 'SeatNoteDeleted', seatId: seat.seatId, noteId: command.noteId }];
	},

	SetSeatLook(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		if (command.avatar === seat.avatar && command.frame === seat.frame) {
			warn('no-change', 'the look is unchanged');
			return [];
		}
		const event: GameEvent = { type: 'SeatLookSet', seatId: seat.seatId };
		if (command.avatar !== undefined) event.avatar = command.avatar;
		if (command.frame !== undefined) event.frame = command.frame;
		return [event];
	},

	SetGameNote(game, command, ctx, warn) {
		const note = writtenNote(game.notes, command, warn);
		return note ? [{ type: 'GameNoteSet', note }] : [];
	},

	DeleteGameNote(game, command) {
		if (!game.notes?.some((n) => n.noteId === command.noteId))
			refuse('unknown-note', `no note ${command.noteId}`);
		return [{ type: 'GameNoteDeleted', noteId: command.noteId }];
	},

	SwapSeats(game, command, ctx, warn) {
		const a = seatOf(game, command.seatA);
		const b = seatOf(game, command.seatB);
		if (a.seatId === b.seatId) refuse('same-seat', 'choose two different seats');
		const seating = game.seating.map((id) =>
			id === a.seatId ? b.seatId : id === b.seatId ? a.seatId : id
		);
		const swap: GameEvent = { type: 'SeatsSwapped', seatA: a.seatId, seatB: b.seatId };
		return [...seatNumberNames(game), ...reseated(game, seating, swap, ctx, warn)];
	},

	RotateSeats(game, command, ctx, warn) {
		const { seating } = game;
		if (command.direction !== 'clockwise' && command.direction !== 'anticlockwise') {
			refuse('invalid-direction', 'rotate clockwise or anticlockwise');
		}
		if (seating.length < 2) {
			warn('no-change', 'there are fewer than 2 seats');
			return [];
		}
		const rotated =
			command.direction === 'clockwise'
				? [seating[seating.length - 1], ...seating.slice(0, -1)]
				: [...seating.slice(1), seating[0]];
		return [...seatNumberNames(game), { type: 'SeatingReordered', seating: rotated }];
	},

	MoveSeat(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		const { position } = command;
		const last = game.seating.length - 1;
		if (!Number.isInteger(position) || position < 0 || position > last) {
			refuse('invalid-position', `position must be from 0 to ${last}`);
		}
		if (game.seating.indexOf(seat.seatId) === position) {
			warn('no-change', 'the player is already there');
			return [];
		}
		const seating = game.seating.filter((id) => id !== seat.seatId);
		seating.splice(position, 0, seat.seatId);
		return [
			...seatNumberNames(game),
			...reseated(game, seating, { type: 'SeatingReordered', seating }, ctx, warn)
		];
	}
};

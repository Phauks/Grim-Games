/**
 * The reducers for seats, their players, notes and look, and the seating order, one for each event
 * type (`reducer.ts` looks them up).
 */
import { parseAvatarId } from '#lib/core/avatars/index.ts';
import type { Game, GameNote, Seat } from '#lib/core/model/index.ts';
import { newSeat, omit, updateSeat, type Reducers } from '#lib/core/engine/reduce/shared.ts';

function withNotes(game: Game, notes: GameNote[]): Game {
	return notes.length ? { ...game, notes } : omit(game, 'notes');
}

function putNote(notes: readonly GameNote[] = [], note: GameNote): GameNote[] {
	return notes.some((n) => n.noteId === note.noteId)
		? notes.map((n) => (n.noteId === note.noteId ? note : n))
		: [...notes, note];
}

function setNote(game: Game, note: GameNote): Game {
	return withNotes(game, putNote(game.notes, note));
}

function withSeatNotes(seat: Seat, notes: GameNote[]): Seat {
	return notes.length ? { ...seat, notes } : omit(seat, 'notes');
}

export const SEATS_REDUCERS: Reducers<
	| 'ScriptChanged'
	| 'SeatAdded'
	| 'SeatInPlaySet'
	| 'SeatRemoved'
	| 'SeatRenamed'
	| 'SeatNoteSaved'
	| 'SeatNoteDeleted'
	| 'SeatLookSet'
	| 'GameNoteSet'
	| 'GameNoteDeleted'
	| 'SeatingReordered'
	| 'SeatsSwapped'
	| 'StorytellerNameSet'
> = {
	ScriptChanged(game, event) {
		return { ...game, script: event.script };
	},
	SeatAdded(game, event) {
		if (Object.hasOwn(game.seats, event.seatId)) return game;
		const seating = [...game.seating];
		seating.splice(Math.max(0, Math.min(event.position, seating.length)), 0, event.seatId);
		return {
			...game,
			seats: {
				...game.seats,
				[event.seatId]: newSeat(event.seatId, event.playerName, event.notInPlay)
			},
			seating
		};
	},
	SeatInPlaySet(game, event) {
		return updateSeat(game, event.seatId, (seat) =>
			event.inPlay ? omit(seat, 'notInPlay') : { ...seat, notInPlay: true }
		);
	},
	SeatRemoved(game, event) {
		if (!Object.hasOwn(game.seats, event.seatId)) return game;
		const removed = {
			...game,
			seats: omit(game.seats, event.seatId),
			seating: game.seating.filter((id) => id !== event.seatId)
		};
		const reincarnated = game.reincarnated?.filter((id) => id !== event.seatId);
		if (reincarnated === undefined) return removed;
		return reincarnated.length > 0 ? { ...removed, reincarnated } : omit(removed, 'reincarnated');
	},
	SeatRenamed(game, event) {
		return updateSeat(game, event.seatId, (seat) =>
			event.playerName === undefined
				? omit(seat, 'playerName')
				: { ...seat, playerName: event.playerName }
		);
	},
	SeatNoteSaved(game, event) {
		return updateSeat(game, event.seatId, (seat) =>
			withSeatNotes(seat, putNote(seat.notes, event.note))
		);
	},
	SeatNoteDeleted(game, event) {
		return updateSeat(game, event.seatId, (seat) =>
			withSeatNotes(
				seat,
				(seat.notes ?? []).filter((n) => n.noteId !== event.noteId)
			)
		);
	},
	SeatLookSet(game, event) {
		return updateSeat(game, event.seatId, (seat) => {
			const next: Seat = omit(seat, 'avatar', 'frame');
			const avatar = parseAvatarId(event.avatar);
			if (avatar !== undefined) next.avatar = avatar;
			if (event.frame !== undefined) next.frame = event.frame;
			return next;
		});
	},
	GameNoteSet(game, event) {
		return setNote(game, event.note);
	},
	GameNoteDeleted(game, event) {
		return withNotes(
			game,
			(game.notes ?? []).filter((n) => n.noteId !== event.noteId)
		);
	},
	SeatingReordered(game, event) {
		// Only a reordering of the same seats.
		const same =
			event.seating.length === game.seating.length &&
			new Set(event.seating).size === event.seating.length &&
			event.seating.every((id) => Object.hasOwn(game.seats, id));
		return same ? { ...game, seating: [...event.seating] } : game;
	},
	SeatsSwapped(game, event) {
		const a = game.seating.indexOf(event.seatA);
		const b = game.seating.indexOf(event.seatB);
		if (a === -1 || b === -1) return game;
		const seating = [...game.seating];
		seating[a] = event.seatB;
		seating[b] = event.seatA;
		// Swaps by day are counted (the Matron's); the setup's seating fixes are not.
		if (game.pastDays.length === 0) return { ...game, seating };
		const swaps = (game.today.swaps ?? 0) + 1;
		return { ...game, seating, today: { ...game.today, swaps } };
	},
	StorytellerNameSet(game, event) {
		return event.name === undefined
			? omit(game, 'storytellerName')
			: { ...game, storytellerName: event.name };
	}
};

/**
 * Seating on the grim (plan J38; Trevor, 2026-10-29: the board should match where people really
 * sit). While the Storyteller has seating open, each phone drags its own disc round the circle on
 * its Grim tab, and the drop asks to sit between two neighbours. Once seating is locked, a phone
 * with no seat taps an open seat to claim it. The room only passes these on: the Storyteller's
 * device makes the change on the board, through its own commands, so it can be undone there.
 */
import type { PlayerName } from '#lib/core/data/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import type { RoomState } from './room.ts';

/** What a phone asks of the Storyteller's device, passed on by the room. */
export interface SitWish {
	type: 'sit';
	memberId: string;
	/** Seating open: sit right after this seat, going round in seat order. */
	after?: SeatId;
	/** Seating locked: sit in this open seat. */
	seatId?: SeatId;
}

/** Opens seating, or locks it; a new game locks it again (`publish`). */
export function setSeatingOpen(room: RoomState, open: unknown): RoomState {
	if (open === true) return room.seatingOpen ? room : { ...room, seatingOpen: true };
	if (!room.seatingOpen) return room;
	const { seatingOpen: _open, ...rest } = room;
	void _open;
	return rest;
}

/**
 * The wish to pass on to the Storyteller's device, or undefined when the room should drop it: a
 * phone with no name, a seat not at the table, a move while seating is locked, or a claim while
 * it is open or on a seat that has a player.
 */
export function sitWish(
	room: RoomState,
	memberId: string,
	message: { type: 'sit'; after: unknown } | { type: 'claim-seat'; seatId: unknown }
): SitWish | undefined {
	const member = room.members.find((m) => m.memberId === memberId);
	if (!member?.name || !room.public) return undefined;
	const seats = room.public.seats;
	if (message.type === 'sit') {
		if (!room.seatingOpen || !seats.some((s) => s.seatId === message.after)) return undefined;
		return { type: 'sit', memberId, after: message.after as SeatId };
	}
	const seat = seats.find((s) => s.seatId === message.seatId);
	if (room.seatingOpen || member.seatId || !seat || !isOpenSeat(seat)) return undefined;
	return { type: 'sit', memberId, seatId: seat.seatId };
}

/**
 * A seat no player has: unnamed, or named only by its number, as the board names seats when
 * players move so nobody's name shifts (seatNumberNames). A name the Storyteller typed for a
 * player without a phone is a player, so that seat is not open.
 */
export const isOpenSeat = (seat: { playerName?: string } | undefined) =>
	!seat?.playerName || /^Seat \d+$/.test(seat.playerName);

const key = (name: string) => name.replace(/\s+/g, ' ').trim().toLocaleLowerCase();

type SeatCommand = Extract<Command, { type: 'RenameSeat' | 'MoveSeat' | 'AddSeat' }>;

/**
 * The board commands that grant a wish from the phone named `name`. Phones sit by name
 * (room-seating.ts), so a phone's seat is the one with its name. Moving after a seat takes the
 * phone's own seat there; a phone with no seat yet takes the first open seat there, or a new
 * seat when none is open. Claiming names the open seat. Nothing when it is already so.
 */
export function sitCommands(
	seating: readonly SeatId[],
	seats: Readonly<Record<SeatId, { playerName?: string }>>,
	name: string,
	wish: Pick<SitWish, 'after' | 'seatId'>
): SeatCommand[] {
	const playerName = name as PlayerName;
	const own = seating.find(
		(id) => seats[id]?.playerName && key(seats[id].playerName!) === key(name)
	);
	if (wish.seatId) {
		if (own || !seating.includes(wish.seatId) || !isOpenSeat(seats[wish.seatId])) return [];
		return [{ type: 'RenameSeat', seatId: wish.seatId, playerName }];
	}
	const after = wish.after;
	if (!after || after === own || !seating.includes(after)) return [];
	const free = (id: SeatId) => isOpenSeat(seats[id]);
	// The seat it drops beside is taken last, as it is already about there.
	const open =
		own ?? seating.find((id) => id !== after && free(id)) ?? (free(after) ? after : undefined);
	if (open === after) return [{ type: 'RenameSeat', seatId: after, playerName }];
	if (!open) {
		const position = seating.indexOf(after) + 1;
		return [{ type: 'AddSeat', playerName, position }];
	}
	const rest = seating.filter((id) => id !== open);
	const position = rest.indexOf(after) + 1;
	const commands: SeatCommand[] = own ? [] : [{ type: 'RenameSeat', seatId: open, playerName }];
	if (seating.indexOf(open) !== position)
		commands.push({ type: 'MoveSeat', seatId: open, position });
	return commands;
}

/**
 * Where a disc dropped at `at` goes in the circle: between the two neighbouring seats it adds
 * the least distance to, so it works for any layout, not just a ring. `ids` and `points` are the
 * other seats, in seat order. Returns the seat it goes after, and the one it goes before.
 */
export function dropBetween(
	ids: readonly SeatId[],
	points: readonly { x: number; y: number }[],
	at: { x: number; y: number }
): { after: SeatId; before: SeatId } | undefined {
	if (ids.length === 0) return undefined;
	const d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
		Math.hypot(a.x - b.x, a.y - b.y);
	let best = 0;
	let cost = Infinity;
	for (let i = 0; i < ids.length; i++) {
		const j = (i + 1) % ids.length;
		const c = d(points[i], at) + d(at, points[j]) - d(points[i], points[j]);
		if (c < cost) {
			cost = c;
			best = i;
		}
	}
	return { after: ids[best], before: ids[(best + 1) % ids.length] };
}

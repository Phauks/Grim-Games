/**
 * Seating on the grim (plan J38; Trevor, 2026-10-29: the board should match where people really
 * sit). While the Storyteller has seating open, each phone drags its own disc round the circle on
 * its Grim tab onto the seat it wants, which lights up, and the drop asks to take that seat's place
 * (Trevor, 2026-10-31: not between seats). Once seating is locked, a phone
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
	/** Seating open: take this seat's place at the table. */
	onto?: SeatId;
	/** Seating open, from older apps: sit right after this seat, going round in seat order. */
	after?: SeatId;
	/** Seating open: move the phone's seat to this point, in % of the board (seat layout). */
	place?: { x: number; y: number };
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
	message:
		| { type: 'sit'; onto?: unknown; after?: unknown; place?: unknown }
		| { type: 'claim-seat'; seatId: unknown }
): SitWish | undefined {
	const member = room.members.find((m) => m.memberId === memberId);
	if (!member?.name || !room.public) return undefined;
	const seats = room.public.seats;
	if (message.type === 'sit') {
		const at = (id: unknown) => seats.some((s) => s.seatId === id);
		if (!room.seatingOpen) return undefined;
		if (at(message.onto)) return { type: 'sit', memberId, onto: message.onto as SeatId };
		if (at(message.after)) return { type: 'sit', memberId, after: message.after as SeatId };
		const place = boardPoint(message.place);
		return place ? { type: 'sit', memberId, place } : undefined;
	}
	const seat = seats.find((s) => s.seatId === message.seatId);
	if (room.seatingOpen || member.seatId || !seat || !isOpenSeat(seat)) return undefined;
	return { type: 'sit', memberId, seatId: seat.seatId };
}

/** A point on the board, in %, or undefined for anything else. */
function boardPoint(value: unknown): { x: number; y: number } | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const { x, y } = value as Record<string, unknown>;
	const ok = (n: unknown): n is number =>
		typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100;
	return ok(x) && ok(y) ? { x, y } : undefined;
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

/** The seat of the phone named `name`: phones sit by name (room-seating.ts). */
export function ownSeat(
	seating: readonly SeatId[],
	seats: Readonly<Record<SeatId, { playerName?: string }>>,
	name: string
): SeatId | undefined {
	return seating.find((id) => seats[id]?.playerName && key(seats[id].playerName!) === key(name));
}

/**
 * The board commands that grant a wish from the phone named `name`. Phones sit by name
 * (room-seating.ts), so a phone's seat is the one with its name.
 *
 * Taking a seat's place (`onto`): onto an open seat, the phone's own seat and that one swap
 * places, as the chair it left is now the empty one; onto a player's seat, the phone's seat goes
 * there and that player moves one place towards where the phone was. A phone with no seat yet
 * names an open seat it lands on, or else brings the first open seat (or a new one when none is
 * open) to that place.
 *
 * Moving after a seat (older apps) takes the phone's own seat there; a phone with no seat yet
 * takes the first open seat there, or a new seat when none is open. Claiming names the open
 * seat. Nothing when it is already so.
 */
export function sitCommands(
	seating: readonly SeatId[],
	seats: Readonly<Record<SeatId, { playerName?: string; characterId?: string }>>,
	name: string,
	wish: Pick<SitWish, 'onto' | 'after' | 'seatId'>
): SeatCommand[] {
	const playerName = name as PlayerName;
	const own = ownSeat(seating, seats, name);
	if (wish.seatId) {
		if (own || !seating.includes(wish.seatId) || !isOpenSeat(seats[wish.seatId])) return [];
		return [{ type: 'RenameSeat', seatId: wish.seatId, playerName }];
	}
	if (wish.onto) return ontoCommands(seating, seats, playerName, own, wish.onto);
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
 * The seat a phone named `name` moves when it drops its disc in a space: its own seat, or for a
 * phone with no seat yet the first open seat, named for it (`commands`). Undefined when it has
 * no seat and none is open.
 */
export function placedSeat(
	seating: readonly SeatId[],
	seats: Readonly<Record<SeatId, { playerName?: string }>>,
	name: string
): { seatId: SeatId; commands: SeatCommand[] } | undefined {
	const own = ownSeat(seating, seats, name);
	if (own) return { seatId: own, commands: [] };
	const open = seating.find((id) => isOpenSeat(seats[id]));
	if (!open) return undefined;
	return {
		seatId: open,
		commands: [{ type: 'RenameSeat', seatId: open, playerName: name as PlayerName }]
	};
}

function ontoCommands(
	seating: readonly SeatId[],
	seats: Readonly<Record<SeatId, { playerName?: string; characterId?: string }>>,
	playerName: PlayerName,
	own: SeatId | undefined,
	onto: SeatId
): SeatCommand[] {
	const place = seating.indexOf(onto);
	if (place < 0 || onto === own) return [];
	const free = (id: SeatId) => isOpenSeat(seats[id]);
	if (!own && free(onto)) return [{ type: 'RenameSeat', seatId: onto, playerName }];
	const moving = own ?? seating.find(free);
	if (!moving) return [{ type: 'AddSeat', playerName, position: place }];
	const commands: SeatCommand[] = own ? [] : [{ type: 'RenameSeat', seatId: moving, playerName }];
	const from = seating.indexOf(moving);
	commands.push({ type: 'MoveSeat', seatId: moving, position: place });
	if (own && free(onto)) {
		// The open seat goes back to where the phone was: after the first move it sits one place
		// nearer the phone's old seat, so it needs a move only when the two were not neighbours.
		if (Math.abs(from - place) > 1)
			commands.push({ type: 'MoveSeat', seatId: onto, position: from });
		// An empty chair with no character is named for where it now is, not where it was.
		if (!seats[onto]?.characterId)
			commands.push({
				type: 'RenameSeat',
				seatId: onto,
				playerName: `Seat ${from + 1}` as PlayerName
			});
	}
	return commands;
}

/**
 * The seat a disc held at `at` would take: the nearest of `points` (the other seats, in seat
 * order), when it is within `reach`. Positions are in pixels, so it works for any layout.
 */
export function dropOnto(
	ids: readonly SeatId[],
	points: readonly { x: number; y: number }[],
	at: { x: number; y: number },
	reach: number
): SeatId | undefined {
	let best: SeatId | undefined;
	let nearest = reach;
	ids.forEach((id, i) => {
		const d = Math.hypot(points[i].x - at.x, points[i].y - at.y);
		if (d <= nearest) {
			nearest = d;
			best = id;
		}
	});
	return best;
}

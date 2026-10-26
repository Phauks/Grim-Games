/**
 * Players' own characters in the live room (Trevor, 2026-10-26): the Storyteller's device
 * sends every seat's role (`seat-roles.ts`) while players may see them; the room gives each
 * phone its own seat's only, and tells the Storyteller who has looked. Kept apart from
 * `room.ts` so each stays a readable size.
 */
import type { SeatId } from '#lib/core/model/index.ts';
import type { RoomState } from './room.ts';
import { parseSeatRole, roleKey, type SeatRole } from './seat-roles.ts';

/** The roles the room holds for one game. */
export interface RoomRoles {
	gameId: string;
	/** Players may see their roles now; while off, the room holds none. */
	show: boolean;
	seats: Record<SeatId, SeatRole>;
	/**
	 * The role each seat's player last looked at (`roleKey`), kept while roles are hidden, so
	 * the Storyteller still sees who has looked. A changed role is not seen until looked at.
	 */
	seen: Record<SeatId, string>;
}

/** The most seats a roles message carries: one per member. */
const MAX_ROLE_SEATS = 40;

/**
 * The Storyteller's roles for game `gameId`, or `show: false` to hide them all. Only the
 * game on the table counts; a malformed message changes nothing.
 */
export function setRoles(room: RoomState, gameId: unknown, show: unknown, raw: unknown): RoomState {
	if (typeof gameId !== 'string' || gameId !== room.gameId || typeof show !== 'boolean')
		return room;
	const seats: Record<SeatId, SeatRole> = {};
	if (show && typeof raw === 'object' && raw !== null) {
		const known = new Set(room.public?.seats.map((s) => s.seatId));
		for (const [seatId, value] of Object.entries(raw).slice(0, MAX_ROLE_SEATS)) {
			const role = parseSeatRole(value);
			if (role && known.has(seatId as SeatId)) seats[seatId as SeatId] = role;
		}
	}
	const seen = room.roles?.gameId === gameId ? room.roles.seen : {};
	return { ...room, roles: { gameId, show, seats, seen } };
}

/** The roles of the game on the table, if the room has any. */
function current(room: RoomState): RoomRoles | undefined {
	return room.roles?.gameId === room.gameId ? room.roles : undefined;
}

/** This member's own role, while players may see theirs. */
export function memberRole(room: RoomState, memberId: string): SeatRole | undefined {
	const roles = current(room);
	const seatId = room.members.find((m) => m.memberId === memberId)?.seatId;
	return roles?.show && seatId ? roles.seats[seatId] : undefined;
}

/** A player looked at their role; nothing changes if they have none to see. */
export function roleSeen(room: RoomState, memberId: string): RoomState {
	const role = memberRole(room, memberId);
	const seatId = room.members.find((m) => m.memberId === memberId)?.seatId;
	const roles = current(room);
	if (!role || !seatId || !roles) return room;
	const key = roleKey(role);
	if (roles.seen[seatId] === key) return room;
	return { ...room, roles: { ...roles, seen: { ...roles.seen, [seatId]: key } } };
}

/** The seats whose player has looked at the role they have now, for the Storyteller. */
export function seatsSeen(room: RoomState): SeatId[] {
	const roles = current(room);
	if (!roles) return [];
	return (Object.keys(roles.seen) as SeatId[]).filter((seatId) => {
		const role = roles.seats[seatId];
		// Hidden roles are not resent, so what was looked at last still counts.
		return roles.show ? !!role && roleKey(role) === roles.seen[seatId] : true;
	});
}

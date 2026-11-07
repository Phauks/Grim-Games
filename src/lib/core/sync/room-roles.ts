/**
 * Players' own characters in the live room (Trevor, 2026-10-26): the Storyteller's device
 * sends every seat's role (`seat-roles.ts`) while players may see them; the room gives each
 * phone its own seat's only, and tells the Storyteller who has looked. Kept apart from
 * `room.ts` so each stays a readable size.
 */
import type { SeatId } from '#lib/core/model/index.ts';
import type { RoomState } from './room.ts';
import { parseSeatRole, roleKey, type SeatRole } from './seat-roles.ts';

export type { SeatRole };

/** The roles the room holds for one game; another game's are ignored until replaced. */
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
	/**
	 * Seats whose player may see their own character while the rest may not: a spectator the
	 * Storyteller has just given a seat (Trevor, 2026-11-06, "Give a seat"), so nobody else's
	 * character opens with theirs.
	 */
	open?: SeatId[];
}

/** The most seats a roles message carries: one per member. */
const MAX_ROLE_SEATS = 40;

/**
 * The Storyteller's roles for game `gameId`, or `show: false` to hide them all but those of
 * the `open` seats. Only the game on the table counts; a malformed message changes nothing.
 */
export function setRoles(
	room: RoomState,
	gameId: unknown,
	show: unknown,
	raw: unknown,
	rawOpen?: unknown
): RoomState {
	if (typeof gameId !== 'string' || gameId !== room.gameId || typeof show !== 'boolean')
		return room;
	const known = new Set(room.public?.seats.map((s) => s.seatId));
	const open = Array.isArray(rawOpen)
		? rawOpen
				.slice(0, MAX_ROLE_SEATS)
				.filter((id): id is SeatId => typeof id === 'string' && known.has(id as SeatId))
		: [];
	const seats: Record<SeatId, SeatRole> = {};
	if ((show || open.length) && typeof raw === 'object' && raw !== null) {
		for (const [seatId, value] of Object.entries(raw).slice(0, MAX_ROLE_SEATS)) {
			const role = parseSeatRole(value);
			const kept = show || open.includes(seatId as SeatId);
			if (role && kept && known.has(seatId as SeatId)) seats[seatId as SeatId] = role;
		}
	}
	const seen = room.roles?.gameId === gameId ? room.roles.seen : {};
	return { ...room, roles: { gameId, show, seats, seen, ...(open.length ? { open } : {}) } };
}

/**
 * A phone took seat `seatId`: what the seat's last player looked at is no longer seen, so the
 * Storyteller doesn't read a new player as having seen their character.
 */
export function seatTaken(room: RoomState, seatId: SeatId): RoomState {
	const roles = room.roles;
	if (!roles || !(seatId in roles.seen)) return room;
	const { [seatId]: _gone, ...seen } = roles.seen;
	void _gone;
	return { ...room, roles: { ...roles, seen } };
}

/** The roles of the game on the table, if the room has any. */
function current(room: RoomState): RoomRoles | undefined {
	return room.roles?.gameId === room.gameId ? room.roles : undefined;
}

/** This member's own role, while players may see theirs. */
export function memberRole(room: RoomState, memberId: string): SeatRole | undefined {
	const roles = current(room);
	const seatId = room.members.find((m) => m.memberId === memberId)?.seatId;
	if (!roles || !seatId) return undefined;
	return roles.show || roles.open?.includes(seatId) ? roles.seats[seatId] : undefined;
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

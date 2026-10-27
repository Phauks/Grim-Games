/** Which phones a room holds, and which of them are part of the game on the table. */
import type { RoomState } from './room.ts';

export const MAX_MEMBERS = 40;

/**
 * Adds a member on first hello; `null` when the room is full. A full room first lets go of
 * phones from earlier games: members with no seat whose phone is not connected
 * (`present`) and was not during this game, so a room in use for many games never fills with
 * phones that left.
 */
export function join(
	room: RoomState,
	memberId: string,
	present?: ReadonlySet<string>
): RoomState | null {
	if (room.members.some((m) => m.memberId === memberId)) return room;
	let members = room.members;
	if (members.length >= MAX_MEMBERS && present) {
		members = members.filter(
			(m) =>
				m.seatId !== undefined ||
				present.has(m.memberId) ||
				(room.gameId !== undefined && m.game === room.gameId)
		);
	}
	if (members.length >= MAX_MEMBERS) return null;
	return { ...room, members: [...members, { memberId }] };
}

/** A connected phone is part of the game on the table now (`RoomMember.game`). */
export function markHere(room: RoomState, memberId: string): RoomState {
	const game = room.gameId;
	const member = room.members.find((m) => m.memberId === memberId);
	if (!member || game === undefined || member.game === game) return room;
	return { ...room, members: room.members.map((m) => (m === member ? { ...m, game } : m)) };
}

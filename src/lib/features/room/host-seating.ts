/**
 * Where a phone asks to sit (plan J38), made on the Storyteller's board as ordinary commands,
 * so each is in History and can be undone. The board stays the Storyteller's: a move that no
 * longer fits (the seat it named is gone, the open seat was taken) changes nothing.
 */
import type { ClientMessage, RoomMember, SitWish } from '#lib/core/sync/room.ts';
import { sitCommands } from '#lib/core/sync/room-seating-open.ts';
import type { OpenGame } from '#lib/features/game/session.svelte.ts';

export function grantSit(game: OpenGame, members: readonly RoomMember[], wish: SitWish): void {
	const name = members.find((m) => m.memberId === wish.memberId)?.name;
	if (!name) return;
	const { seating, seats } = game.game;
	for (const command of sitCommands(seating, seats, name, wish)) game.run(command);
}

/**
 * Removes a phone from the room for this game (plan J37). Its seat on the board loses the
 * player's name, as an undoable rename, so Unblock never seats it there again by name (Trevor,
 * 2026-10-31: "they have to rejoin all over again"). False when offline: nothing changes.
 */
export function removeFromRoom(
	host: { members: readonly RoomMember[]; send(message: ClientMessage): boolean },
	game: OpenGame,
	memberId: string
): boolean {
	const seatId = host.members.find((m) => m.memberId === memberId)?.seatId;
	if (!host.send({ type: 'remove', memberId })) return false;
	if (seatId && game.game.seats[seatId]?.playerName) game.run({ type: 'RenameSeat', seatId });
	return true;
}

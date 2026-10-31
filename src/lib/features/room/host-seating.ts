/**
 * Where a phone asks to sit (plan J38), made on the Storyteller's board as ordinary commands,
 * so each is in History and can be undone. The board stays the Storyteller's: a move that no
 * longer fits (the seat it named is gone, the open seat was taken) changes nothing. A phone
 * moving its seat to a place (Trevor, 2026-10-31) changes where the board draws it, through
 * `place`, as the Storyteller's own drag does when arranging.
 */
import type { ClientMessage, RoomMember, SitWish } from '#lib/core/sync/room.ts';
import { ownSeat, placedSeat, sitCommands } from '#lib/core/sync/room-seating-open.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import type { OpenGame } from '#lib/features/game/session.svelte.ts';

/** Where the open board draws its seats (its seat layout, in % of the board). */
export interface BoardPlaces {
	/** Draws a seat at a point. */
	place(seatId: SeatId, point: { x: number; y: number }): void;
	/** Two seats trade the places they are drawn at, hand-placed spots and gaps (swapPlaces). */
	swap(a: SeatId, b: SeatId): void;
}

let open: { gameId: string; places: BoardPlaces } | undefined;

/** The board open on this device, for a phone moving its seat (GrimoirePage). */
export function openBoardPlaces(gameId: string, places: BoardPlaces): void {
	open = { gameId, places };
}

/** Where the board of `game` draws its seats, while it is the board open on this device. */
export function boardPlaces(game: OpenGame): BoardPlaces | undefined {
	return open?.gameId === game.game.gameId ? open.places : undefined;
}

export function grantSit(
	game: OpenGame,
	members: readonly RoomMember[],
	wish: SitWish,
	places?: BoardPlaces
): void {
	const name = members.find((m) => m.memberId === wish.memberId)?.name;
	if (!name) return;
	const { seating, seats } = game.game;
	if (wish.place) {
		const seat = places && placedSeat(seating, seats, name);
		if (!seat) return;
		for (const command of seat.commands) if (!game.run(command).ok) return;
		places.place(seat.seatId, wish.place);
		return;
	}
	const own = ownSeat(seating, seats, name);
	const commands = sitCommands(seating, seats, name, wish);
	for (const command of commands) if (!game.run(command).ok) return;
	// Taking a seat's place takes where it is drawn too, so a seat placed by hand is not left
	// behind (the Storyteller's own drop onto a seat swaps places the same way).
	if (wish.onto && own && commands.length) places?.swap(own, wish.onto);
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

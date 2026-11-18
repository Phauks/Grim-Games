import { seatsInOrder, type SeatId } from '#lib/core/model/index.ts';
import type { PlayerName } from '#lib/core/data/index.ts';
import type { RoomMember } from '#lib/core/sync/room.ts';
import type { OpenGame } from '#lib/features/game/session.svelte.ts';
import { seatName } from '#lib/features/game/seat-label.ts';
import type { RoomHost } from './host.svelte.ts';

/** A player at the table: a seat, with the phone sitting there if any, or a phone with no seat. */
export interface TableEntry {
	key: string;
	seatId?: SeatId;
	name: PlayerName;
	member?: RoomMember;
	/** Whose messages are theirs: the phone's member id. */
	inboxId?: string;
}

/**
 * Every seat is a player, phone or not (Trevor, 2026-10-29: "every player has a seat. and it
 * would still be player management for the non-phone users"), in seat order.
 */
export function tablePlayers(game: OpenGame, host: RoomHost): TableEntry[] {
	return seatsInOrder(game.game).map((seat) => {
		const member = host.members.find((m) => m.seatId === seat.seatId);
		const name = seatName(game.game, seat.seatId);
		return { key: seat.seatId, seatId: seat.seatId, name, member, inboxId: member?.memberId };
	});
}

/**
 * Spectators (Trevor, 2026-11-03): the phones with no seat from this game, which stay listed
 * while they sleep (earlier games' are left out).
 */
export function tableSpectators(host: RoomHost): TableEntry[] {
	return host.unseatedInGame.flatMap((m) =>
		m.name ? [{ key: m.memberId, name: m.name, member: m, inboxId: m.memberId }] : []
	);
}

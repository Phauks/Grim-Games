/**
 * Where a phone asks to sit (plan J38), made on the Storyteller's board as ordinary commands,
 * so each is in History and can be undone. The board stays the Storyteller's: a move that no
 * longer fits (the seat it named is gone, the open seat was taken) changes nothing.
 */
import type { RoomMember, SitWish } from '#lib/core/sync/room.ts';
import { sitCommands } from '#lib/core/sync/room-seating-open.ts';
import type { OpenGame } from '#lib/features/game/session.svelte.ts';

export function grantSit(game: OpenGame, members: readonly RoomMember[], wish: SitWish): void {
	const name = members.find((m) => m.memberId === wish.memberId)?.name;
	if (!name) return;
	const { seating, seats } = game.game;
	for (const command of sitCommands(seating, seats, name, wish)) game.run(command);
}

import type { GameOver, SharedGrimoire } from '#lib/core/sync/room.ts';
import type {
	PublicCorner,
	PublicLook,
	PublicSeat,
	PublicSeatLayout
} from '#lib/core/sync/public-projection.ts';

/**
 * The town as the table knows it, given to PlayerGrim by the Storyteller's board (Trevor,
 * 2026-10-23: the board's Script shows every screen a player has) or by Public Town; a phone
 * reads its room instead.
 */
export interface PlayerGrimTown {
	seats: readonly PublicSeat[];
	layout?: PublicSeatLayout;
	storytellerName?: string;
	corner?: PublicCorner;
	/** The board's background, as it shares it with every grim of the game. */
	look?: PublicLook;
	/** The board's own picture, on the Storyteller's device; else the room's (pictureRoom). */
	picture?: Blob;
	pictureRoom?: string;
	/** Where the guesses and seat notes are kept; a display keeps none. */
	guessKey?: string;
	/** The room's code for the corner, where it isn't this device's own room. */
	roomCode?: string;
	/** Each seat's player's picture (2026-10-27); else, on the board, this device's room's. */
	pictures?: Partial<Record<string, string>>;
	/**
	 * The finished grimoire the Storyteller shared (Share grim, R5), as the room sent it to
	 * phones, how the game ended and the room holding its background; a phone reads its room's.
	 */
	final?: { grimoire: SharedGrimoire; ended?: Omit<GameOver, 'gameId'>; room?: string };
}

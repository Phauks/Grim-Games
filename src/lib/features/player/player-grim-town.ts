import type { ProfileWords } from '#lib/core/profile/index.ts';
import type { GameOver, SharedGrimoire } from '#lib/core/sync/room.ts';
import type { RoomPlayer } from '#lib/features/room/player.svelte.ts';
import { roomHost } from '#lib/features/room/host.svelte.ts';
import { roomImagePath } from '#lib/core/sync/room-images.ts';
import { wordsOf } from '#lib/core/sync/room-look.ts';
import type {
	PublicCorner,
	PublicStoryteller,
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
	storyteller?: PublicStoryteller;
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
	/** Each seat's player's tag-line and details (2026-11-01); else, on the board, its room's. */
	profiles?: Partial<Record<string, ProfileWords>>;
	/**
	 * The finished grimoire the Storyteller shared (Share grim, R5), as the room sent it to
	 * phones, how the game ended and the room holding its background; a phone reads its room's.
	 */
	final?: { grimoire: SharedGrimoire; ended?: Omit<GameOver, 'gameId'>; room?: string };
}

type FinalGrimoire = NonNullable<PlayerGrimTown['final']>;

/**
 * The finished grimoire the Grim tab shows (Share grim, R5): the one the Storyteller's board
 * hands its player view (Trevor, 2026-10-30), else the one this phone's room sent.
 */
export function finalGrimoireOf(
	town: PlayerGrimTown | undefined,
	player: RoomPlayer | undefined,
	room: string | undefined
): FinalGrimoire | undefined {
	if (town) return town.final;
	const sent = player?.revealed;
	return sent && { grimoire: sent.grimoire, ended: player?.view?.ended, room };
}

/** Where a grim reads its seats' pictures and words: the town it was given, or its room's view. */
export interface SeatSource {
	town?: PlayerGrimTown;
	view?: RoomPlayer['view'];
	code?: string | null;
	display: boolean;
}

/**
 * A seat's player's picture: the room's copy, or the board's own on the Storyteller's device
 * when its room has none (no display shows the host's).
 */
export function seatPicture(seatId: string, { town, view, code, display }: SeatSource) {
	const hash = (town ? town.pictures : view?.pictures)?.[seatId];
	const room = town ? town.roomCode : code;
	if (hash && room) return roomImagePath(room, hash);
	return town && !town.roomCode && !display ? roomHost().pictureOf(seatId) : undefined;
}

/** A seat's player's tag-line and details, from wherever its picture comes (2026-11-01). */
export function seatWords(
	seatId: string,
	{ town, view, display }: SeatSource
): ProfileWords | undefined {
	const words = (town ? town.profiles : view?.profiles)?.[seatId];
	if (words) return words;
	if (!town || town.roomCode || display) return undefined;
	const member = roomHost().members.find((m) => m.seatId === seatId);
	return member ? wordsOf(member) : undefined;
}

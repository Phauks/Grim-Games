/**
 * Live sync (04-architecture.md §8.2): what player devices may see, and the port that
 * publishes it.
 *
 * The public projection is built field by field from an allow-list, never by copying
 * the game and deleting secrets, so a new private field cannot leak by default.
 */
import {
	REGISTERS_AS_DEAD_REMINDERS,
	seatsInOrder,
	type Game,
	type Seat,
	type SeatId
} from '#lib/core/model/index.ts';
import type { CharacterId } from '#lib/core/data/index.ts';
import type { AvatarId } from '#lib/core/avatars/index.ts';
import type { FrameId } from '#lib/core/frames/index.ts';

export interface PublicSeat {
	seatId: SeatId;
	/** 1-based, clockwise. */
	seatNumber: number;
	playerName?: string;
	/**
	 * Dead as the town sees it: also true for a Zombuul after its first death, which
	 * looks like a death to everyone. Storyteller overrides are private and ignored.
	 */
	dead: boolean;
	/**
	 * A dead player's ghost vote, spent in front of everyone (Trevor, 2026-10-19: the players'
	 * Grim shows "who has dead votes"). Only on seats that show as dead.
	 */
	ghostVote?: 'unused' | 'used';
	/**
	 * A Traveller's character: Travellers tell the town who they are
	 * (https://wiki.bloodontheclocktower.com/Travellers), so the players' script can show it
	 * in play (Trevor, 2026-10-19). Never set for any other character, nor when the game's
	 * mode keeps Travellers secret (Stowed Away).
	 */
	traveller?: CharacterId;
	/** The avatar and frame the seat's player picked on their phone (plan R6): theirs to show. */
	avatar?: AvatarId;
	frame?: FrameId;
}

/**
 * Today's public events. Nominations and executions happen in front of everyone, so the
 * town may see them; the day log's other entries stay private: ability uses (a "No
 * Ability" token, or a use logged for a player who is not really that character), notes,
 * night info and the Flowergirl's "Demon voted" mark all reveal characters. Whether an
 * execution killed the player is not repeated here: `dead` on the seat already shows it.
 */
export interface PublicDay {
	/** In the order they were made. */
	nominations: { nominator: SeatId; nominee: SeatId }[];
	executions: SeatId[];
}

/**
 * Where the Storyteller's board draws the seats (plan J13): its ring's shape, the gaps, and
 * the seats placed by hand, by seat id, as percentages of the board. Where people sit is
 * plain to the whole table, so phones draw the town the same way. Phones parse it before
 * use (parseSeatLayout), as they would a saved layout.
 */
export interface PublicSeatLayout {
	shape: string;
	gaps: Readonly<Record<string, number>>;
	placed: Readonly<Record<string, { x: number; y: number }>>;
}

export interface PublicGameState {
	/** The Storyteller's name, when the game has one: the table already knows who runs it. */
	storytellerName?: string;
	/** In clockwise seating order. */
	seats: PublicSeat[];
	today: PublicDay;
	/** Left out while the board draws its seats on the plain ring. */
	layout?: PublicSeatLayout;
}

/** The layout's three parts only, or nothing when it is the plain oval ring. */
function boardLayout(layout: PublicSeatLayout): PublicSeatLayout | undefined {
	const { shape, gaps, placed } = layout;
	if (shape === 'oval' && Object.keys(gaps).length === 0 && Object.keys(placed).length === 0)
		return undefined;
	return {
		shape,
		gaps: { ...gaps },
		placed: Object.fromEntries(Object.entries(placed).map(([id, p]) => [id, { x: p.x, y: p.y }]))
	};
}

function appearsDead(seat: Seat): boolean {
	return (
		seat.dead ||
		seat.reminders.some((r) =>
			REGISTERS_AS_DEAD_REMINDERS.some(
				(d) => d.characterId === r.characterId && d.label === r.label
			)
		)
	);
}

/**
 * @param publicTraveller Whether a character is a Traveller the town knows about: the
 *   caller knows the character types and the game's mode. Left out, no character is shown.
 * @param layout Where the board draws the seats, kept on the Storyteller's device.
 */
export function publicProjection(
	game: Game,
	publicTraveller?: (characterId: CharacterId) => boolean,
	layout?: PublicSeatLayout
): PublicGameState {
	const drawn = layout && boardLayout(layout);
	return {
		...(game.storytellerName ? { storytellerName: game.storytellerName } : {}),
		...(drawn ? { layout: drawn } : {}),
		seats: seatsInOrder(game).map((seat, i) => {
			const view: PublicSeat = {
				seatId: seat.seatId,
				seatNumber: i + 1,
				dead: appearsDead(seat)
			};
			if (seat.playerName !== undefined) view.playerName = seat.playerName;
			if (seat.avatar !== undefined) view.avatar = seat.avatar;
			if (seat.frame !== undefined) view.frame = seat.frame;
			// Every seat that looks dead shows a vote the same way, so a Zombuul looks no different.
			if (view.dead) view.ghostVote = seat.ghostVoteUsed ? 'used' : 'unused';
			if (seat.characterId && publicTraveller?.(seat.characterId))
				view.traveller = seat.characterId;
			return view;
		}),
		today: {
			nominations: game.today.entries.flatMap((e) =>
				e.kind === 'nomination' ? [{ nominator: e.nominator, nominee: e.nominee }] : []
			),
			executions: game.today.entries.flatMap((e) => (e.kind === 'execution' ? [e.seatId] : []))
		}
	};
}

/**
 * Publishes public state to other devices. Only `PublicGameState` ever crosses this
 * port, so a provider cannot send the grimoire even by mistake.
 */
export interface SyncProvider {
	publish(state: PublicGameState): Promise<void>;
	close(): Promise<void>;
}

/** The provider used until live sync ships: publishes nothing. */
export class NoopSyncProvider implements SyncProvider {
	async publish(state: PublicGameState): Promise<void> {
		void state;
	}
	async close(): Promise<void> {}
}

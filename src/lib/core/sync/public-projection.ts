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
	// No ghost votes: the Storyteller doesn't track them (Trevor, 2026-10-16); players keep
	// their own on their phones.
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

export interface PublicGameState {
	/** In clockwise seating order. */
	seats: PublicSeat[];
	today: PublicDay;
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

export function publicProjection(game: Game): PublicGameState {
	return {
		seats: seatsInOrder(game).map((seat, i) => {
			const view: PublicSeat = {
				seatId: seat.seatId,
				seatNumber: i + 1,
				dead: appearsDead(seat)
			};
			if (seat.playerName !== undefined) view.playerName = seat.playerName;
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

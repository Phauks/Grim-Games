import type { GameId, SeatId } from '#lib/core/model/index.ts';

/**
 * Players with no phone, still to see their character on the Storyteller's device after
 * Show characters (Trevor, 2026-11-01: "it should use the same functionality as when they do
 * it from the normal draw area"): the draw shows each one's tile with their name, held, and
 * the usual reveal and Confirm. Kept on this device only, for one game at a time.
 */
class NoPhoneDraw {
	gameId = $state<GameId>();
	seats = $state.raw<readonly SeatId[]>([]);

	start(gameId: GameId, seats: readonly SeatId[]): void {
		this.gameId = gameId;
		this.seats = seats;
	}

	/** The seats still to see theirs in this game. */
	waiting(gameId: GameId | undefined): readonly SeatId[] {
		return gameId && this.gameId === gameId ? this.seats : [];
	}

	/** This player has seen theirs. */
	done(seatId: SeatId): void {
		this.seats = this.seats.filter((s) => s !== seatId);
	}
}

export const noPhoneDraw = new NoPhoneDraw();

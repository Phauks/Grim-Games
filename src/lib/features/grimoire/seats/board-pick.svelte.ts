/**
 * A player picked by tapping their seat on the board (Trevor, 2026-11-17: "Picking a player
 * should just invoke same way we show valid picks for a reminder token"). A night step beside
 * the board asks for one; the board marks the seats as for a reminder in hand (SeatHints:
 * the ones that fit glow, the others fade), the pill at the board's foot says whose pick it is,
 * and the next seat tapped answers it. The step's own drop-down still works.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';

export interface BoardPick {
	/** Whose pick it is: the pill shows its token, `label` its words. */
	characterId: CharacterId | undefined;
	label: string;
	/** The seats that may be picked; the rest fade but can still be tapped. */
	seats: readonly SeatId[];
	/** The seats of the player picking, ringed as a reminder's own seats are. */
	sources: readonly SeatId[];
	pick: (seatId: SeatId) => void;
}

class BoardPicking {
	/** The pick waiting for a seat, if any. */
	current = $state<BoardPick | undefined>();

	/** Asks for `pick`; the returned cleanup stops it if it is still this one. */
	ask(pick: BoardPick): () => void {
		this.current = pick;
		return () => {
			if (this.current === pick) this.current = undefined;
		};
	}

	/** A seat tapped: answers the pick. False when nothing waits. */
	answer(seatId: SeatId): boolean {
		const pick = this.current;
		if (!pick) return false;
		this.current = undefined;
		pick.pick(seatId);
		return true;
	}

	cancel(): void {
		this.current = undefined;
	}
}

export const boardPick = new BoardPicking();

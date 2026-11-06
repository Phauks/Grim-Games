import type { GameId, SeatId } from '#lib/core/model/index.ts';
import { ROLES_SHOWN_MS } from './roles-shown.svelte.ts';

/**
 * Seats given to a spectator (Give a seat, Trevor 2026-11-06): their new player may see their
 * own character for as long as players may when all are shown theirs (ROLES_SHOWN_MS), while
 * nobody else's opens. Only while that phone still sits there.
 */
export class SeatLooks {
	#looks = $state.raw<readonly { gameId: string; seatId: SeatId; memberId: string }[]>([]);

	/** Lets the phone `memberId`, just given seat `seatId`, see its own character. */
	give(gameId: GameId, seatId: SeatId, memberId: string): void {
		const look = { gameId, seatId, memberId };
		this.#looks = [...this.#looks.filter((l) => l.seatId !== seatId), look];
		setTimeout(() => (this.#looks = this.#looks.filter((l) => l !== look)), ROLES_SHOWN_MS);
	}

	/** The seats of game `gameId` whose player may look now, given where each phone sits. */
	open(gameId: string, seatOf: (memberId: string) => SeatId | undefined): SeatId[] {
		return this.#looks.flatMap((l) =>
			l.gameId === gameId && seatOf(l.memberId) === l.seatId ? [l.seatId] : []
		);
	}

	clear(): void {
		this.#looks = [];
	}
}

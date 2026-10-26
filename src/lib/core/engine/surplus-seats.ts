import type { Game, SeatId } from '../model/types.ts';

/**
 * The seats to remove so the game seats `players`: empty ones only (no player name, no
 * character, not holding a drawn tile), latest first. New game makes a seat per player up
 * front, so lowering the count in Character selection must take the extra seats away again.
 */
export function surplusSeats(game: Game, players: number): SeatId[] {
	const extra = game.seating.length - players;
	if (extra <= 0) return [];
	const holding = new Set(
		Object.values(game.bag?.tiles ?? {}).flatMap((tile) =>
			tile.drawnBySeat === undefined ? [] : [tile.drawnBySeat]
		)
	);
	return game.seating
		.filter((id) => {
			const seat = game.seats[id];
			return (
				seat !== undefined &&
				seat.playerName === undefined &&
				seat.characterId === undefined &&
				!holding.has(id)
			);
		})
		.reverse()
		.slice(0, extra);
}

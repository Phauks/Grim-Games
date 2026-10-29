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

/**
 * The seats the game will have once it seats `players`, in seat order: the seats kept by
 * {@link surplusSeats}, then a placeholder for each seat still to add. Character selection
 * shows these before the count is seated, so its candles follow the player count.
 */
export function seatsForCount(
	game: Game,
	players: number
): { seatId: SeatId; playerName?: string }[] {
	const removed = new Set(surplusSeats(game, players));
	const kept = game.seating
		.filter((id) => !removed.has(id))
		.map((id) => ({ seatId: id, playerName: game.seats[id]?.playerName }));
	const added = Array.from({ length: Math.max(0, players - kept.length) }, (_, i) => ({
		seatId: `planned-${kept.length + i + 1}`
	}));
	return [...kept, ...added];
}

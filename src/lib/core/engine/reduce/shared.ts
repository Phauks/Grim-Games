/** What the reducers share: the map type and the helpers more than one domain uses. */
import type { PlayerName } from '#lib/core/data/index.ts';
import type { Game, Seat, SeatId } from '#lib/core/model/index.ts';
import type { EventOf, GameEventType } from '#lib/core/engine/events.ts';

/** One reducer per event type: applies that event to a game and returns the new game. */
export type Reducers<K extends GameEventType> = {
	[T in K]: (game: Game, event: EventOf<T>) => Game;
};

export function updateSeat(game: Game, seatId: SeatId, update: (seat: Seat) => Seat): Game {
	if (!Object.hasOwn(game.seats, seatId)) return game;
	return { ...game, seats: { ...game.seats, [seatId]: update(game.seats[seatId]) } };
}

export function omit<T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> {
	const copy = { ...value };
	for (const key of keys) delete copy[key];
	return copy;
}

export function replaceAt<T>(list: T[], index: number, item: T): T[] {
	if (!Number.isInteger(index) || index < 0 || index >= list.length) return list;
	return list.map((x, i) => (i === index ? item : x));
}

export function removeAt<T>(list: T[], index: number): T[] {
	if (!Number.isInteger(index) || index < 0 || index >= list.length) return list;
	return list.filter((_, i) => i !== index);
}

/** A new seat: alive, with its ghost vote, and nothing on it. */
export function newSeat(seatId: SeatId, playerName?: PlayerName, notInPlay?: true): Seat {
	const seat: Seat = { seatId, dead: false, ghostVoteUsed: false, overrides: [], reminders: [] };
	if (playerName !== undefined) seat.playerName = playerName;
	if (notInPlay) seat.notInPlay = true;
	return seat;
}

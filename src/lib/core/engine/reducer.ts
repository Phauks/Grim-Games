/**
 * The reducer: applies one event to a game and returns a new game. Pure and total; it
 * never looks at character data, the clock or randomness, which the events already
 * carry. Events that refer to something missing (a seat removed since) change nothing.
 *
 * Each event type has one reducer, in a map per domain under `reduce/` (as the deciders are
 * under `decide/`), so `applyEvent` is a lookup and the type checks every event has one.
 */
import type { Game } from '#lib/core/model/index.ts';
import type { GameEvent, GameEventType } from './events.ts';
import { newSeat, type Reducers } from './reduce/shared.ts';
import { SEATS_REDUCERS } from './reduce/seats.ts';
import { CHARACTERS_REDUCERS } from './reduce/characters.ts';
import { OVERRIDES_REDUCERS } from './reduce/overrides.ts';
import { VOTES_REDUCERS } from './reduce/votes.ts';
import { REMINDERS_REDUCERS } from './reduce/reminders.ts';
import { BLUFFS_BAG_REDUCERS } from './reduce/bluffs-bag.ts';
import { DAY_REDUCERS } from './reduce/day.ts';

const REDUCERS: Reducers<Exclude<GameEventType, 'GameCreated'>> = {
	...SEATS_REDUCERS,
	...CHARACTERS_REDUCERS,
	...OVERRIDES_REDUCERS,
	...VOTES_REDUCERS,
	...REMINDERS_REDUCERS,
	...BLUFFS_BAG_REDUCERS,
	...DAY_REDUCERS
};

/** Applies `event` to `game`. Only `GameCreated` may be applied to no game. */
export function applyEvent(game: Game | undefined, event: GameEvent): Game {
	if (event.type === 'GameCreated') {
		return {
			gameId: event.gameId,
			createdAt: event.createdAt,
			script: event.script,
			seats: Object.fromEntries(event.seatIds.map((id) => [id, newSeat(id)])),
			seating: [...event.seatIds],
			ruleCharacters: [],
			bluffs: [],
			bluffNames: [],
			fakeEvilInfo: {},
			ruleReminders: {},
			looseReminders: [],
			genericTokens: [],
			nightOrderOverrides: [],
			dayReminderOverrides: [],
			today: { entries: [] },
			pastDays: []
		};
	}
	if (!game) throw new Error(`${event.type} applied before GameCreated`);
	const reduce = REDUCERS[event.type] as (game: Game, event: GameEvent) => Game;
	return reduce(game, event);
}

/** Applies events in order. */
export function applyEvents(
	game: Game | undefined,
	events: readonly GameEvent[]
): Game | undefined {
	return events.reduce<Game | undefined>((g, e) => applyEvent(g, e), game);
}

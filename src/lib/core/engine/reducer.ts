/**
 * The reducer: applies one event to a game and returns a new game. Pure and total; it
 * never looks at character data, the clock or randomness, which the events already
 * carry. Events that refer to something missing (a seat removed since) change nothing.
 */
import type { Game, Seat, SeatId } from '#lib/core/model/index.ts';
import type { GameEvent } from './events.ts';

function newSeat(seatId: SeatId, playerName?: string): Seat {
	const seat: Seat = { seatId, dead: false, ghostVoteUsed: false, overrides: [], reminders: [] };
	if (playerName !== undefined) seat.playerName = playerName;
	return seat;
}

function updateSeat(game: Game, seatId: SeatId, update: (seat: Seat) => Seat): Game {
	if (!Object.hasOwn(game.seats, seatId)) return game;
	return { ...game, seats: { ...game.seats, [seatId]: update(game.seats[seatId]) } };
}

function seatHoldingReminder(game: Game, reminderId: string): Seat | undefined {
	return Object.values(game.seats).find((s) =>
		s.reminders.some((r) => r.reminderId === reminderId)
	);
}

/** A shallow copy without the given keys. */
function omit<T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> {
	const copy = { ...value };
	for (const key of keys) delete copy[key];
	return copy;
}

/** Inserts `item` at `index` (clamped); the list is not changed. */
function insertAt<T>(list: readonly T[], index: number, item: T): T[] {
	const copy = [...list];
	copy.splice(Math.max(0, Math.min(index, copy.length)), 0, item);
	return copy;
}

/** Replaces the item at `index`, or returns the list itself when there is none. */
function replaceAt<T>(list: T[], index: number, item: T): T[] {
	if (!Number.isInteger(index) || index < 0 || index >= list.length) return list;
	return list.map((x, i) => (i === index ? item : x));
}

/** Removes the item at `index`, or returns the list itself when there is none. */
function removeAt<T>(list: T[], index: number): T[] {
	if (!Number.isInteger(index) || index < 0 || index >= list.length) return list;
	return list.filter((_, i) => i !== index);
}

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
			nightOrderOverrides: [],
			dayReminderOverrides: [],
			today: { entries: [] },
			pastDays: []
		};
	}
	if (!game) throw new Error(`${event.type} applied before GameCreated`);

	switch (event.type) {
		case 'SeatAdded': {
			if (Object.hasOwn(game.seats, event.seatId)) return game;
			const seating = [...game.seating];
			seating.splice(Math.max(0, Math.min(event.position, seating.length)), 0, event.seatId);
			return {
				...game,
				seats: { ...game.seats, [event.seatId]: newSeat(event.seatId, event.playerName) },
				seating
			};
		}
		case 'SeatRemoved':
			if (!Object.hasOwn(game.seats, event.seatId)) return game;
			return {
				...game,
				seats: omit(game.seats, event.seatId),
				seating: game.seating.filter((id) => id !== event.seatId)
			};
		case 'SeatRenamed':
			return updateSeat(game, event.seatId, (seat) =>
				event.playerName === undefined
					? omit(seat, 'playerName')
					: { ...seat, playerName: event.playerName }
			);
		case 'CharacterAssigned':
			return updateSeat(game, event.seatId, (seat) => ({
				...seat,
				characterId: event.characterId,
				alignment: event.alignment
			}));
		case 'CharacterCleared':
			return updateSeat(game, event.seatId, (seat) => omit(seat, 'characterId', 'alignment'));
		case 'AlignmentSet':
			return updateSeat(game, event.seatId, (seat) => ({ ...seat, alignment: event.alignment }));
		case 'DeathSet':
			return updateSeat(game, event.seatId, (seat) => {
				const next = omit(seat, 'deathCause');
				return event.dead && event.cause !== undefined
					? { ...next, dead: true, deathCause: event.cause }
					: { ...next, dead: event.dead };
			});
		case 'DeathCauseSet':
			return updateSeat(game, event.seatId, (seat) =>
				event.cause === undefined ? omit(seat, 'deathCause') : { ...seat, deathCause: event.cause }
			);
		case 'NightStepOverrideAdded': {
			const nightOrderOverrides = insertAt(
				game.nightOrderOverrides,
				event.index,
				structuredClone(event.override)
			);
			return { ...game, nightOrderOverrides };
		}
		case 'NightStepOverrideReplaced': {
			const nightOrderOverrides = replaceAt(
				game.nightOrderOverrides,
				event.index,
				structuredClone(event.override)
			);
			return nightOrderOverrides === game.nightOrderOverrides
				? game
				: { ...game, nightOrderOverrides };
		}
		case 'NightStepOverrideRemoved': {
			const nightOrderOverrides = removeAt(game.nightOrderOverrides, event.index);
			return nightOrderOverrides === game.nightOrderOverrides
				? game
				: { ...game, nightOrderOverrides };
		}
		case 'DayReminderOverrideAdded': {
			const dayReminderOverrides = insertAt(
				game.dayReminderOverrides,
				event.index,
				structuredClone(event.override)
			);
			return { ...game, dayReminderOverrides };
		}
		case 'DayReminderOverrideReplaced': {
			const dayReminderOverrides = replaceAt(
				game.dayReminderOverrides,
				event.index,
				structuredClone(event.override)
			);
			return dayReminderOverrides === game.dayReminderOverrides
				? game
				: { ...game, dayReminderOverrides };
		}
		case 'DayReminderOverrideRemoved': {
			const dayReminderOverrides = removeAt(game.dayReminderOverrides, event.index);
			return dayReminderOverrides === game.dayReminderOverrides
				? game
				: { ...game, dayReminderOverrides };
		}
		case 'GhostVoteSpent':
			return updateSeat(game, event.seatId, (seat) => ({ ...seat, ghostVoteUsed: true }));
		case 'GhostVoteRestored':
			return updateSeat(game, event.seatId, (seat) => ({ ...seat, ghostVoteUsed: false }));
		case 'ReminderAdded':
			return updateSeat(game, event.seatId, (seat) => ({
				...seat,
				reminders: [...seat.reminders, { ...event.reminder }]
			}));
		case 'ReminderMoved': {
			const from = seatHoldingReminder(game, event.reminderId);
			if (!from || !Object.hasOwn(game.seats, event.toSeatId)) return game;
			if (from.seatId === event.toSeatId) return game;
			const reminder = from.reminders.find((r) => r.reminderId === event.reminderId)!;
			const removed = updateSeat(game, from.seatId, (seat) => ({
				...seat,
				reminders: seat.reminders.filter((r) => r.reminderId !== event.reminderId)
			}));
			return updateSeat(removed, event.toSeatId, (seat) => ({
				...seat,
				reminders: [...seat.reminders, reminder]
			}));
		}
		case 'ReminderRemoved': {
			const from = seatHoldingReminder(game, event.reminderId);
			if (!from) return game;
			return updateSeat(game, from.seatId, (seat) => ({
				...seat,
				reminders: seat.reminders.filter((r) => r.reminderId !== event.reminderId)
			}));
		}
		case 'SeatsSwapped': {
			const a = game.seating.indexOf(event.seatA);
			const b = game.seating.indexOf(event.seatB);
			if (a === -1 || b === -1) return game;
			const seating = [...game.seating];
			seating[a] = event.seatB;
			seating[b] = event.seatA;
			return { ...game, seating };
		}
		case 'OverrideSet':
			return updateSeat(game, event.seatId, (seat) => ({
				...seat,
				overrides: [
					...seat.overrides.filter((o) => o.field !== event.override.field),
					{ ...event.override }
				]
			}));
		case 'OverrideCleared':
			return updateSeat(game, event.seatId, (seat) => ({
				...seat,
				overrides: seat.overrides.filter((o) => o.field !== event.field)
			}));
		case 'RuleCharacterAdded':
			if (game.ruleCharacters.includes(event.characterId)) return game;
			return { ...game, ruleCharacters: [...game.ruleCharacters, event.characterId] };
		case 'RuleCharacterRemoved':
			return {
				...game,
				ruleCharacters: game.ruleCharacters.filter((id) => id !== event.characterId)
			};
		case 'BluffsSet': {
			const bluffs = game.bluffs.map((set) => [...set]);
			if (event.set < 0 || event.set > bluffs.length) return game;
			bluffs[event.set] = [...event.characterIds];
			return { ...game, bluffs };
		}
		case 'BluffSetRemoved':
			return { ...game, bluffs: game.bluffs.filter((_, i) => i !== event.set) };
		case 'BagBuilt':
			return {
				...game,
				bag: {
					tiles: Object.fromEntries(event.tiles.map((t) => [t.tileId, structuredClone(t)])),
					order: [...event.order],
					includeTravellers: event.includeTravellers
				}
			};
		case 'BagCleared':
			return omit(game, 'bag');
		case 'TileDrawn': {
			const bag = game.bag;
			if (!bag || !Object.hasOwn(bag.tiles, event.tileId)) return game;
			return {
				...game,
				bag: {
					...bag,
					tiles: {
						...bag.tiles,
						[event.tileId]: { ...bag.tiles[event.tileId], drawnBySeat: event.seatId }
					},
					order: bag.order.filter((id) => id !== event.tileId)
				}
			};
		}
		case 'DrawConfirmed': {
			const bag = game.bag;
			if (!bag || !Object.hasOwn(bag.tiles, event.tileId)) return game;
			return {
				...game,
				bag: {
					...bag,
					tiles: { ...bag.tiles, [event.tileId]: { ...bag.tiles[event.tileId], confirmed: true } }
				}
			};
		}
		case 'DayEntryAdded':
			if (game.today.entries.some((e) => e.entryId === event.entry.entryId)) return game;
			return {
				...game,
				today: { ...game.today, entries: [...game.today.entries, structuredClone(event.entry)] }
			};
		case 'DayEntryReplaced': {
			const index = game.today.entries.findIndex((e) => e.entryId === event.entry.entryId);
			const entries = replaceAt(game.today.entries, index, structuredClone(event.entry));
			return entries === game.today.entries ? game : { ...game, today: { ...game.today, entries } };
		}
		case 'DayEntryRemoved': {
			const index = game.today.entries.findIndex((e) => e.entryId === event.entryId);
			const entries = removeAt(game.today.entries, index);
			return entries === game.today.entries ? game : { ...game, today: { ...game.today, entries } };
		}
		case 'DemonVotedSet':
			return {
				...game,
				today:
					event.voted === undefined
						? omit(game.today, 'demonVoted')
						: { ...game.today, demonVoted: event.voted }
			};
		case 'PrepValueSet': {
			const prepValues = { ...game.prepValues };
			if (event.value === undefined) delete prepValues[event.key];
			else prepValues[event.key] = event.value;
			return { ...game, prepValues };
		}
		case 'DayStarted':
			return {
				...game,
				today: { entries: [] },
				pastDays: [...game.pastDays, { ...game.today, closedAt: event.at }]
			};
		case 'DrawCancelled': {
			const bag = game.bag;
			if (!bag || !Object.hasOwn(bag.tiles, event.tileId)) return game;
			const tile = omit(bag.tiles[event.tileId], 'drawnBySeat');
			const order = bag.order.filter((id) => id !== event.tileId);
			order.splice(Math.max(0, Math.min(event.position, order.length)), 0, event.tileId);
			return {
				...game,
				bag: {
					...bag,
					tiles: { ...bag.tiles, [event.tileId]: { ...tile, confirmed: false } },
					order
				}
			};
		}
	}
}

/** Applies events in order. */
export function applyEvents(
	game: Game | undefined,
	events: readonly GameEvent[]
): Game | undefined {
	return events.reduce<Game | undefined>((g, e) => applyEvent(g, e), game);
}

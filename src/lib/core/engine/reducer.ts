/**
 * The reducer: applies one event to a game and returns a new game. Pure and total; it
 * never looks at character data, the clock or randomness, which the events already
 * carry. Events that refer to something missing (a seat removed since) change nothing.
 */
import { parseAvatarId } from '#lib/core/avatars/index.ts';
import type { CharacterId, PlayerName } from '#lib/core/data/index.ts';
import type { DayMark } from '#lib/core/data/day-mark-rules.ts';
import type { Game, GameNote, ReminderInstance, Seat, SeatId } from '#lib/core/model/index.ts';
import type { GameEvent } from './events.ts';

function newSeat(seatId: SeatId, playerName?: PlayerName): Seat {
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

/** The Fabled or Loric holding a reminder, with what it holds. */
function ruleHoldingReminder(
	game: Game,
	reminderId: string
): { characterId: CharacterId; reminders: ReminderInstance[] } | undefined {
	for (const [characterId, reminders] of Object.entries(game.ruleReminders ?? {})) {
		if (reminders.some((r) => r.reminderId === reminderId)) return { characterId, reminders };
	}
	return undefined;
}

function withRuleReminder(game: Game, characterId: CharacterId, reminder: ReminderInstance): Game {
	const held = game.ruleReminders?.[characterId] ?? [];
	return { ...game, ruleReminders: { ...game.ruleReminders, [characterId]: [...held, reminder] } };
}

function withoutRuleReminder(game: Game, reminderId: string): Game {
	const ruleReminders: Record<CharacterId, ReminderInstance[]> = {};
	for (const [characterId, held] of Object.entries(game.ruleReminders ?? {})) {
		ruleReminders[characterId] = held.filter((r) => r.reminderId !== reminderId);
	}
	return { ...game, ruleReminders };
}

function looseReminder(game: Game, reminderId: string): ReminderInstance | undefined {
	return game.looseReminders?.find((r) => r.reminderId === reminderId);
}

function withoutLooseReminder(game: Game, reminderId: string): Game {
	return {
		...game,
		looseReminders: (game.looseReminders ?? []).filter((r) => r.reminderId !== reminderId)
	};
}

/** Changes one reminder wherever it is: on a seat, a Fabled or Loric, or loose. */
function withReminder(
	game: Game,
	reminderId: string,
	change: (reminder: ReminderInstance) => ReminderInstance
): Game {
	const each = (list: readonly ReminderInstance[]) =>
		list.map((r) => (r.reminderId === reminderId ? change(r) : r));
	const seat = seatHoldingReminder(game, reminderId);
	if (seat) return updateSeat(game, seat.seatId, (s) => ({ ...s, reminders: each(s.reminders) }));
	const held = ruleHoldingReminder(game, reminderId);
	if (held)
		return {
			...game,
			ruleReminders: { ...game.ruleReminders, [held.characterId]: each(held.reminders) }
		};
	if (looseReminder(game, reminderId))
		return { ...game, looseReminders: each(game.looseReminders ?? []) };
	return game;
}

/** Takes a reminder from its seat or Fabled or Loric; undefined when it is not on either. */
function liftHeldReminder(
	game: Game,
	reminderId: string
): { game: Game; reminder: ReminderInstance } | undefined {
	const held = ruleHoldingReminder(game, reminderId);
	if (held) {
		const reminder = held.reminders.find((r) => r.reminderId === reminderId)!;
		return { game: withoutRuleReminder(game, reminderId), reminder };
	}
	const seat = seatHoldingReminder(game, reminderId);
	if (!seat) return undefined;
	const reminder = seat.reminders.find((r) => r.reminderId === reminderId)!;
	return {
		game: updateSeat(game, seat.seatId, (s) => ({
			...s,
			reminders: s.reminders.filter((r) => r.reminderId !== reminderId)
		})),
		reminder
	};
}

/** A shallow copy without the given keys. */
/**
 * The note an old game's single general note becomes (`GameNotesSet`), and so does an old
 * seat's single note (`SeatNoteSet`).
 */
const LEGACY_NOTE = 'n1';

/** The game with these notes, or none when the list is empty. */
function withNotes(game: Game, notes: GameNote[]): Game {
	return notes.length ? { ...game, notes } : omit(game, 'notes');
}

/** The notes with the one of this id replaced in place, or it added at the end. */
function putNote(notes: readonly GameNote[] = [], note: GameNote): GameNote[] {
	return notes.some((n) => n.noteId === note.noteId)
		? notes.map((n) => (n.noteId === note.noteId ? note : n))
		: [...notes, note];
}

/** Replaces the game note with this id in place, or adds it at the end. */
function setNote(game: Game, note: GameNote): Game {
	return withNotes(game, putNote(game.notes, note));
}

/** The seat with these notes, or none when the list is empty. */
function withSeatNotes(seat: Seat, notes: GameNote[]): Seat {
	return notes.length ? { ...seat, notes } : omit(seat, 'notes');
}

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
		case 'ScriptChanged':
			return { ...game, script: event.script };
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
		case 'SeatNoteSet':
			return updateSeat(game, event.seatId, (seat) =>
				event.note === undefined
					? withSeatNotes(
							seat,
							(seat.notes ?? []).filter((n) => n.noteId !== LEGACY_NOTE)
						)
					: withSeatNotes(
							seat,
							putNote(seat.notes, {
								noteId: LEGACY_NOTE,
								title: '',
								text: event.note,
								hidden: false
							})
						)
			);
		case 'SeatNoteSaved':
			return updateSeat(game, event.seatId, (seat) =>
				withSeatNotes(seat, putNote(seat.notes, event.note))
			);
		case 'SeatNoteDeleted':
			return updateSeat(game, event.seatId, (seat) =>
				withSeatNotes(
					seat,
					(seat.notes ?? []).filter((n) => n.noteId !== event.noteId)
				)
			);
		case 'SeatLookSet':
			return updateSeat(game, event.seatId, (seat) => {
				const next: Seat = omit(seat, 'avatar', 'frame');
				// A picture from the earlier icon set, in a game saved by that beta build, is dropped.
				const avatar = parseAvatarId(event.avatar);
				if (avatar !== undefined) next.avatar = avatar;
				if (event.frame !== undefined) next.frame = event.frame;
				return next;
			});
		case 'GameNotesSet':
			return event.notes === undefined
				? withNotes(
						game,
						(game.notes ?? []).filter((n) => n.noteId !== LEGACY_NOTE)
					)
				: setNote(game, { noteId: LEGACY_NOTE, title: '', text: event.notes, hidden: false });
		case 'GameNoteSet':
			return setNote(game, event.note);
		case 'GameNoteDeleted':
			return withNotes(
				game,
				(game.notes ?? []).filter((n) => n.noteId !== event.noteId)
			);
		case 'CharacterAssigned':
			return updateSeat(game, event.seatId, (seat) =>
				event.alignment === undefined
					? { ...omit(seat, 'alignment'), characterId: event.characterId }
					: { ...seat, characterId: event.characterId, alignment: event.alignment }
			);
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
			const loose = looseReminder(game, event.reminderId);
			if (loose) {
				// From loose on the board onto a seat.
				if (!Object.hasOwn(game.seats, event.toSeatId)) return game;
				return updateSeat(withoutLooseReminder(game, event.reminderId), event.toSeatId, (seat) => ({
					...seat,
					reminders: [...seat.reminders, loose]
				}));
			}
			const held = ruleHoldingReminder(game, event.reminderId);
			if (held) {
				// From a Fabled or Loric back onto a seat.
				if (!Object.hasOwn(game.seats, event.toSeatId)) return game;
				const reminder = held.reminders.find((r) => r.reminderId === event.reminderId)!;
				return updateSeat(withoutRuleReminder(game, event.reminderId), event.toSeatId, (seat) => ({
					...seat,
					reminders: [...seat.reminders, reminder]
				}));
			}
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
			if (looseReminder(game, event.reminderId)) {
				return withoutLooseReminder(game, event.reminderId);
			}
			if (ruleHoldingReminder(game, event.reminderId)) {
				return withoutRuleReminder(game, event.reminderId);
			}
			const from = seatHoldingReminder(game, event.reminderId);
			if (!from) return game;
			return updateSeat(game, from.seatId, (seat) => ({
				...seat,
				reminders: seat.reminders.filter((r) => r.reminderId !== event.reminderId)
			}));
		}
		case 'SeatingReordered': {
			// Only a reordering of the same seats.
			const same =
				event.seating.length === game.seating.length &&
				new Set(event.seating).size === event.seating.length &&
				event.seating.every((id) => Object.hasOwn(game.seats, id));
			return same ? { ...game, seating: [...event.seating] } : game;
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
		case 'RuleCharacterRemoved': {
			const removed: Game = {
				...game,
				ruleCharacters: game.ruleCharacters.filter((id) => id !== event.characterId)
			};
			// Its reminders go back off the board with it.
			if (!game.ruleReminders || !Object.hasOwn(game.ruleReminders, event.characterId)) {
				return removed;
			}
			const ruleReminders = { ...game.ruleReminders };
			delete ruleReminders[event.characterId];
			return { ...removed, ruleReminders };
		}
		case 'RuleReminderAdded':
			if (!game.ruleCharacters.includes(event.characterId)) return game;
			return withRuleReminder(game, event.characterId, { ...event.reminder });
		case 'ReminderMovedToRuleCharacter': {
			if (!game.ruleCharacters.includes(event.characterId)) return game;
			const held = ruleHoldingReminder(game, event.reminderId);
			if (held?.characterId === event.characterId) return game;
			const loose = looseReminder(game, event.reminderId);
			if (loose) {
				return withRuleReminder(
					withoutLooseReminder(game, event.reminderId),
					event.characterId,
					loose
				);
			}
			const seat = seatHoldingReminder(game, event.reminderId);
			const reminder =
				held?.reminders.find((r) => r.reminderId === event.reminderId) ??
				seat?.reminders.find((r) => r.reminderId === event.reminderId);
			if (!reminder) return game;
			const lifted = held
				? withoutRuleReminder(game, event.reminderId)
				: updateSeat(game, seat!.seatId, (s) => ({
						...s,
						reminders: s.reminders.filter((r) => r.reminderId !== event.reminderId)
					}));
			return withRuleReminder(lifted, event.characterId, reminder);
		}
		case 'LooseReminderPlaced':
			return {
				...game,
				looseReminders: [...(game.looseReminders ?? []), { ...event.reminder }]
			};
		case 'ReminderLoosened': {
			const lifted = liftHeldReminder(game, event.reminderId);
			if (!lifted) return game;
			return {
				...lifted.game,
				looseReminders: [...(lifted.game.looseReminders ?? []), lifted.reminder]
			};
		}
		case 'GenericTokenAdded':
			return { ...game, genericTokens: [...(game.genericTokens ?? []), { ...event.token }] };
		case 'GenericTokenSet':
			return {
				...game,
				genericTokens: (game.genericTokens ?? []).map((t) =>
					t.tokenId === event.token.tokenId ? { ...event.token } : t
				)
			};
		case 'GenericTokenRemoved': {
			const genericTokens = (game.genericTokens ?? []).filter((t) => t.tokenId !== event.tokenId);
			return genericTokens.length > 0 ? { ...game, genericTokens } : omit(game, 'genericTokens');
		}
		case 'StorytellerNameSet':
			return event.name === undefined
				? omit(game, 'storytellerName')
				: { ...game, storytellerName: event.name };
		case 'ReminderNoteSet':
			return withReminder(game, event.reminderId, (r) =>
				event.note === undefined ? omit(r, 'note') : { ...r, note: event.note }
			);
		case 'ReminderSymbolSet':
			return withReminder(game, event.reminderId, (r) =>
				event.symbol === undefined ? omit(r, 'symbol') : { ...r, symbol: event.symbol }
			);
		case 'ReminderSymbolColourSet':
			return withReminder(game, event.reminderId, (r) =>
				event.colour === undefined ? omit(r, 'symbolColour') : { ...r, symbolColour: event.colour }
			);
		case 'ReminderSymbolFillSet':
			return withReminder(game, event.reminderId, (r) =>
				event.fill ? { ...r, symbolFill: true } : omit(r, 'symbolFill')
			);
		case 'BluffsSet': {
			const bluffs = game.bluffs.map((set) => [...set]);
			if (event.set < 0 || event.set > bluffs.length) return game;
			bluffs[event.set] = [...event.characterIds];
			return { ...game, bluffs };
		}
		case 'BluffSetRemoved': {
			const bluffs = game.bluffs.filter((_, i) => i !== event.set);
			// Names stay with their sets as the later ones move up.
			if (!game.bluffNames) return { ...game, bluffs };
			return { ...game, bluffs, bluffNames: game.bluffNames.filter((_, i) => i !== event.set) };
		}
		case 'FakeEvilInfoSet': {
			const fakeEvilInfo = { ...game.fakeEvilInfo };
			if (event.info) fakeEvilInfo[event.seatId] = event.info;
			else delete fakeEvilInfo[event.seatId];
			return { ...game, fakeEvilInfo };
		}
		case 'BluffSetRenamed': {
			if (event.set < 0 || event.set >= game.bluffs.length) return game;
			const bluffNames = Array.from(
				{ length: Math.max(game.bluffNames?.length ?? 0, event.set + 1) },
				(_, i) => game.bluffNames?.[i] ?? ''
			);
			bluffNames[event.set] = event.name;
			return { ...game, bluffNames };
		}
		case 'BagBuilt':
			return {
				...game,
				bag: {
					tiles: Object.fromEntries(event.tiles.map((t) => [t.tileId, structuredClone(t)])),
					order: [...event.order],
					includeTravellers: event.includeTravellers,
					...(event.unseated?.length ? { unseated: structuredClone(event.unseated) } : {})
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
			return setDayMark(game, 'demon-voted', event.voted);
		case 'DayMarkSet':
			return setDayMark(game, event.mark, event.value);
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

function setDayMark(game: Game, mark: DayMark, value: boolean | undefined): Game {
	const marks = { ...game.today.marks };
	if (value === undefined) delete marks[mark];
	else marks[mark] = value;
	const today =
		Object.keys(marks).length > 0 ? { ...game.today, marks } : omit(game.today, 'marks');
	return { ...game, today };
}

/**
 * The reducers for reminders on seats, on the Fabled and Loric, or loose, and generic tokens, one
 * for each event type (`reducer.ts` looks them up).
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import type { Game, ReminderInstance, Seat } from '#lib/core/model/index.ts';
import { updateSeat, omit, type Reducers } from '#lib/core/engine/reduce/shared.ts';

function seatHoldingReminder(game: Game, reminderId: string): Seat | undefined {
	return Object.values(game.seats).find((s) =>
		s.reminders.some((r) => r.reminderId === reminderId)
	);
}

function ruleHoldingReminder(
	game: Game,
	reminderId: string
): { characterId: CharacterId; reminders: ReminderInstance[] } | undefined {
	for (const [characterId, reminders] of Object.entries(game.ruleReminders)) {
		if (reminders.some((r) => r.reminderId === reminderId)) return { characterId, reminders };
	}
	return undefined;
}

function withRuleReminder(game: Game, characterId: CharacterId, reminder: ReminderInstance): Game {
	const held = game.ruleReminders[characterId] ?? [];
	return { ...game, ruleReminders: { ...game.ruleReminders, [characterId]: [...held, reminder] } };
}

function withoutRuleReminder(game: Game, reminderId: string): Game {
	const ruleReminders: Record<CharacterId, ReminderInstance[]> = {};
	for (const [characterId, held] of Object.entries(game.ruleReminders)) {
		ruleReminders[characterId] = held.filter((r) => r.reminderId !== reminderId);
	}
	return { ...game, ruleReminders };
}

function looseReminder(game: Game, reminderId: string): ReminderInstance | undefined {
	return game.looseReminders.find((r) => r.reminderId === reminderId);
}

function withoutLooseReminder(game: Game, reminderId: string): Game {
	return {
		...game,
		looseReminders: game.looseReminders.filter((r) => r.reminderId !== reminderId)
	};
}

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
		return { ...game, looseReminders: each(game.looseReminders) };
	return game;
}

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

export const REMINDERS_REDUCERS: Reducers<
	| 'ReminderAdded'
	| 'ReminderMoved'
	| 'ReminderRemoved'
	| 'RuleReminderAdded'
	| 'ReminderMovedToRuleCharacter'
	| 'LooseReminderPlaced'
	| 'ReminderLoosened'
	| 'GenericTokenAdded'
	| 'GenericTokenSet'
	| 'GenericTokenRemoved'
	| 'ReminderEffectSet'
	| 'ReminderMadAsSet'
	| 'ReminderNoteSet'
	| 'ReminderSymbolSet'
	| 'ReminderSymbolColourSet'
	| 'ReminderSymbolFillSet'
	| 'ReminderCountsUpSet'
> = {
	ReminderAdded(game, event) {
		return updateSeat(game, event.seatId, (seat) => ({
			...seat,
			reminders: [...seat.reminders, { ...event.reminder, placedDays: game.pastDays.length }]
		}));
	},
	ReminderMoved(game, event) {
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
	},
	ReminderRemoved(game, event) {
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
	},
	RuleReminderAdded(game, event) {
		if (!game.ruleCharacters.includes(event.characterId)) return game;
		return withRuleReminder(game, event.characterId, { ...event.reminder });
	},
	ReminderMovedToRuleCharacter(game, event) {
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
	},
	LooseReminderPlaced(game, event) {
		return {
			...game,
			looseReminders: [...game.looseReminders, { ...event.reminder }]
		};
	},
	ReminderLoosened(game, event) {
		const lifted = liftHeldReminder(game, event.reminderId);
		if (!lifted) return game;
		return {
			...lifted.game,
			looseReminders: [...lifted.game.looseReminders, lifted.reminder]
		};
	},
	GenericTokenAdded(game, event) {
		return { ...game, genericTokens: [...game.genericTokens, { ...event.token }] };
	},
	GenericTokenSet(game, event) {
		return {
			...game,
			genericTokens: game.genericTokens.map((t) =>
				t.tokenId === event.token.tokenId ? { ...event.token } : t
			)
		};
	},
	GenericTokenRemoved(game, event) {
		const genericTokens = game.genericTokens.filter((t) => t.tokenId !== event.tokenId);
		return { ...game, genericTokens };
	},
	ReminderEffectSet(game, event) {
		return withReminder(game, event.reminderId, (r) =>
			event.effect === undefined ? omit(r, 'effect') : { ...r, effect: { ...event.effect } }
		);
	},
	ReminderMadAsSet(game, event) {
		return withReminder(game, event.reminderId, (r) =>
			event.characterId === undefined ? omit(r, 'madAs') : { ...r, madAs: event.characterId }
		);
	},
	ReminderNoteSet(game, event) {
		return withReminder(game, event.reminderId, (r) =>
			event.note === undefined ? omit(r, 'note') : { ...r, note: event.note }
		);
	},
	ReminderSymbolSet(game, event) {
		return withReminder(game, event.reminderId, (r) =>
			event.symbol === undefined ? omit(r, 'symbol') : { ...r, symbol: event.symbol }
		);
	},
	ReminderSymbolColourSet(game, event) {
		return withReminder(game, event.reminderId, (r) =>
			event.colour === undefined ? omit(r, 'symbolColour') : { ...r, symbolColour: event.colour }
		);
	},
	ReminderSymbolFillSet(game, event) {
		return withReminder(game, event.reminderId, (r) =>
			event.fill ? { ...r, symbolFill: true } : omit(r, 'symbolFill')
		);
	},
	ReminderCountsUpSet(game, event) {
		return withReminder(game, event.reminderId, (r) =>
			event.countsUp === undefined ? omit(r, 'countsUp') : { ...r, countsUp: event.countsUp }
		);
	}
};

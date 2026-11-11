/**
 * Whether a jinx effect's `when` conditions hold now (`data/jinx-conditions.ts`), for the
 * character it is read for (`self`) and its partner. One reader for every verb, so a
 * condition means the same on each. A board the caller doesn't have (only the script) leaves
 * the conditions about it unchecked: the effect may apply, and so may one under a `not`.
 *
 * An effect read at an event (`JinxAt.event`: a game end at an execution, `jinx-ends.ts`) is
 * checked at that moment, not now (M44): the day and the executions are that day's, up to the
 * event, and alive or dead is who was alive just before it, when the log recorded it.
 */
import type { JinxCondition, JinxEffect } from '#lib/core/data/jinx-rules.ts';
import type { CharacterId, ReminderLabel } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, trueCharacter } from '#lib/core/model/selectors.ts';
import type { DayEntry, Game, SeatId } from '#lib/core/model/types.ts';

/** What the caller knows of the game: the script, and the board when it has one. */
export type JinxBoard = Pick<Game, 'script'> &
	Partial<Pick<Game, 'seating' | 'seats' | 'pastDays' | 'today' | 'ruleCharacters'>>;

/** The moment an effect is read at, in place of now. */
export interface JinxEvent {
	/** The day log it is in (0 is before the first dawn), for `day`, `night` and `afterDay`. */
	day: number;
	/** That day's entries up to and including the event, for the executions. */
	entries: readonly DayEntry[];
	/** The players alive just before it, when recorded; else alive or dead is read now. */
	alive?: readonly SeatId[];
}

/** The player the effect is about, when the reader has one. */
export interface JinxAt {
	/** A self player: `self-alive` and `marked` are about them. */
	seatId?: SeatId;
	/** That player has the partner's ability (`has-partner-ability`), as the reader found. */
	hasPartnerAbility?: boolean;
	/** Read at this event, not now. */
	event?: JinxEvent;
}

const NO_LOOKUP: CharacterLookup = new Map();

/** Whether every one of `effect`'s conditions holds for `self` with `partner`. */
export function jinxApplies(
	game: JinxBoard | undefined,
	self: CharacterId,
	partner: CharacterId,
	effect: JinxEffect | undefined,
	characters: CharacterLookup,
	at: JinxAt = {}
): boolean {
	return (effect?.when ?? []).every((c) => check(game, self, partner, c, characters, at) !== false);
}

/** Whether `effect` is about a player who has the partner's ability (`has-partner-ability`). */
export function aboutHolder(effect: JinxEffect | undefined): boolean {
	return effect?.when?.includes('has-partner-ability') === true;
}

/** Whether `c` holds; undefined when the caller's knowledge can't say (no board, no log). */
function check(
	game: JinxBoard | undefined,
	self: CharacterId,
	partner: CharacterId,
	c: JinxCondition,
	characters: CharacterLookup | undefined,
	at: JinxAt
): boolean | undefined {
	if (typeof c === 'object' && 'not' in c) {
		const inner = check(game, self, partner, c.not, characters, at);
		return inner === undefined ? undefined : !inner;
	}
	if (c === 'has-partner-ability') return at.hasPartnerAbility === true;
	// Read from the partner's file, about the partner's player: no reader asks this one yet.
	if (c === 'partner-has-this-ability') return false;
	const days = at.event?.day ?? game?.pastDays?.length;
	if (typeof c === 'object') {
		if (days === undefined && ('afterDay' in c || 'day' in c || 'night' in c)) return undefined;
		if ('afterDay' in c) return days! >= c.afterDay;
		if ('day' in c) return days === c.day;
		if ('night' in c) return days === c.night - 1;
	}
	const entries = at.event?.entries ?? game?.today?.entries;
	if (c === 'after-execution')
		return entries === undefined ? undefined : entries.some((e) => e.kind === 'execution');
	const board = game?.seating && game.seats ? (game as Game) : undefined;
	if (!board) return undefined;
	const lookup = characters ?? NO_LOOKUP;
	const playing = (id: CharacterId) =>
		board.seating.filter((s) => trueCharacter(board, s, lookup) === id);
	const selfSeats = at.seatId !== undefined ? [at.seatId] : playing(self);
	const alive = (s: SeatId) =>
		at.event?.alive ? at.event.alive.includes(s) : !board.seats[s]?.dead;
	const executed = (seats: SeatId[]) =>
		entries === undefined
			? undefined
			: entries.some((e) => e.kind === 'execution' && seats.includes(e.seatId));
	const nominated = (by: SeatId[], of: SeatId[]) =>
		entries === undefined
			? undefined
			: entries.some(
					(e) => e.kind === 'nomination' && by.includes(e.nominator) && of.includes(e.nominee)
				);
	const carries = (seats: SeatId[], of: CharacterId, label: ReminderLabel) =>
		seats.some((s) =>
			board.seats[s]?.reminders.some((r) => r.characterId === of && r.label === label)
		);
	if (typeof c === 'object') {
		if ('marked' in c) return carries(selfSeats, partner, c.marked);
		if ('partnerMarked' in c) return carries(playing(partner), self, c.partnerMarked);
		if ('alive' in c) return playing(c.alive).some(alive);
		if ('inPlay' in c)
			return playing(c.inPlay).length > 0 || (board.ruleCharacters ?? []).includes(c.inPlay);
		const [seats, alignment] =
			'alignment' in c ? [selfSeats, c.alignment] : [playing(partner), c.partnerAlignment];
		return seats.some((s) => alignmentOf(board, s) === alignment);
	}
	switch (c) {
		case 'self-alive':
			return selfSeats.some(alive);
		case 'partner-alive':
			return playing(partner).some(alive);
		case 'self-dead':
			return selfSeats.some((s) => !alive(s));
		case 'partner-dead':
			return playing(partner).some((s) => !alive(s));
		case 'self-in-play':
			return playing(self).length > 0;
		case 'partner-in-play':
			return playing(partner).length > 0;
		case 'self-executed':
			return executed(selfSeats);
		case 'partner-executed':
			return executed(playing(partner));
		case 'nominated-partner':
			return nominated(selfSeats, playing(partner));
		case 'nominated-by-partner':
			return nominated(playing(partner), selfSeats);
		case 'final-day': {
			const left = board.seating.filter((s) => {
				const id = trueCharacter(board, s, lookup);
				return alive(s) && lookup.get(id ?? '')?.type !== 'traveller';
			});
			return left.length <= 3;
		}
	}
}

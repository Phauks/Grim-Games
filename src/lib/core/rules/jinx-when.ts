/**
 * Whether a jinx effect's `when` conditions hold now (`data/jinx-rules.ts`), for the
 * character it is read for (`self`) and its partner. One reader for every verb, so a
 * condition means the same on each. A board the caller doesn't have (only the script) leaves
 * the conditions about it unchecked: the effect may apply.
 */
import type { JinxCondition, JinxEffect } from '#lib/core/data/jinx-rules.ts';
import type { CharacterId, ReminderLabel } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';

/** What the caller knows of the game: the script, and the board when it has one. */
export type JinxBoard = Pick<Game, 'script'> &
	Partial<Pick<Game, 'seating' | 'seats' | 'pastDays' | 'today'>>;

/** The player the effect is about, when the reader has one. */
export interface JinxAt {
	/** A self player: `self-alive` and `marked` are about them. */
	seatId?: SeatId;
	/** That player has the partner's ability (`has-partner-ability`), as the reader found. */
	hasPartnerAbility?: boolean;
}

const NO_LOOKUP: CharacterLookup = new Map();

/** Whether every one of `effect`'s conditions holds for `self` with `partner`. */
export function jinxApplies(
	game: JinxBoard | undefined,
	self: CharacterId,
	partner: CharacterId,
	effect: JinxEffect | undefined,
	characters?: CharacterLookup,
	at: JinxAt = {}
): boolean {
	return (effect?.when ?? []).every((c) => holds(game, self, partner, c, characters, at));
}

/** Whether `effect` is about a player who has the partner's ability (`has-partner-ability`). */
export function aboutHolder(effect: JinxEffect | undefined): boolean {
	return effect?.when?.includes('has-partner-ability') === true;
}

function holds(
	game: JinxBoard | undefined,
	self: CharacterId,
	partner: CharacterId,
	c: JinxCondition,
	characters: CharacterLookup | undefined,
	at: JinxAt
): boolean {
	if (c === 'has-partner-ability') return at.hasPartnerAbility === true;
	// Read from the partner's file, about the partner's player: no reader asks this one yet.
	if (c === 'partner-has-this-ability') return false;
	const board = game?.seating && game.seats ? (game as Game) : undefined;
	const days = game?.pastDays?.length;
	if (typeof c === 'object') {
		if ('afterDay' in c) return days === undefined || days >= c.afterDay;
		if ('day' in c) return days === undefined || days === c.day;
		if ('night' in c) return days === undefined || days === c.night - 1;
	}
	if (c === 'after-execution')
		return !game?.today || game.today.entries.some((e) => e.kind === 'execution');
	if (!board) return true;
	const lookup = characters ?? NO_LOOKUP;
	const playing = (id: CharacterId) =>
		board.seating.filter((s) => trueCharacter(board, s, lookup) === id);
	const selfSeats = at.seatId !== undefined ? [at.seatId] : playing(self);
	const carries = (seats: SeatId[], of: CharacterId, label: ReminderLabel) =>
		seats.some((s) =>
			board.seats[s]?.reminders.some((r) => r.characterId === of && r.label === label)
		);
	if (typeof c === 'object') {
		if ('marked' in c) return carries(selfSeats, partner, c.marked);
		if ('partnerMarked' in c) return carries(playing(partner), self, c.partnerMarked);
		const [seats, alignment] =
			'alignment' in c ? [selfSeats, c.alignment] : [playing(partner), c.partnerAlignment];
		return seats.some((s) => alignmentOf(board, s) === alignment);
	}
	switch (c) {
		case 'self-alive':
			return selfSeats.some((s) => !board.seats[s]?.dead);
		case 'partner-alive':
			return playing(partner).some((s) => !board.seats[s].dead);
		case 'self-in-play':
			return playing(self).length > 0;
		case 'partner-in-play':
			return playing(partner).length > 0;
		case 'final-day': {
			const alive = board.seating.filter((s) => {
				const id = trueCharacter(board, s, lookup);
				return !board.seats[s].dead && lookup.get(id ?? '')?.type !== 'traveller';
			});
			return alive.length <= 3;
		}
	}
}

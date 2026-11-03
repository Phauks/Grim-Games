/**
 * Reminders that come off by themselves (`reminderEnds` in a character's rules block): at the
 * next Dawn (a New day), the next Dusk (the night's first step, ticked when the day ends), the
 * dusk after the next Dawn, or when a player of the reminder's character dies.
 * The Monk's Safe comes off at dawn (https://wiki.bloodontheclocktower.com/Monk), the
 * Poisoner's Poisoned player is healthy again at dusk the next day
 * (https://wiki.bloodontheclocktower.com/Poisoner), the Minstrel's Everyone Is Drunk comes off
 * at dusk tomorrow (https://wiki.bloodontheclocktower.com/Minstrel), the Barista's tokens at
 * the next day's dusk even when placed before tonight's Dusk step was ticked
 * (https://wiki.bloodontheclocktower.com/Barista), and the Philosopher's
 * Drunk when the Philosopher dies (https://wiki.bloodontheclocktower.com/Philosopher).
 *
 * A token a jinx in play still needs by day stays until dusk instead: the Leviathan or Riot
 * executing the player the Monk protected last night ends the game
 * (`jinxes.endsGame.token`, https://wiki.bloodontheclocktower.com/Riot#Related_Jinxes).
 *
 * A token may instead come off at a nomination: the Bishop's Nominate Evil once an evil player
 * is nominated (https://wiki.bloodontheclocktower.com/Bishop). Until then, ending the day
 * warns (`nominationsUnfinished`); it never locks.
 */
import type { ReminderEnd, ReminderEndRule } from '#lib/core/data/parts/reminder-ends.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, trueCharacter } from '#lib/core/model/selectors.ts';
import type {
	Game,
	Reminder,
	ReminderId,
	ReminderInstance,
	SeatId
} from '#lib/core/model/types.ts';
import { ownJinxes } from './jinxes.ts';
import { ownerSeats } from './reminder-targets.ts';

export type { ReminderEnd, ReminderEndRule };

/** When a placed reminder comes off by itself, from its character's `reminderEnds`. */
export function reminderEndOf(
	reminder: Reminder,
	characters: CharacterLookup
): ReminderEndRule | undefined {
	const ends = rulesOf(reminder.characterId, characters)?.reminderEnds;
	const label = reminder.label.toLowerCase();
	const key = ends && Object.keys(ends).find((l) => l.toLowerCase() === label);
	return key === undefined ? undefined : ends?.[key];
}

/** The reminders on the board that come off once a player of `nominee`'s alignment is nominated. */
export function remindersEndingOnNomination(
	game: Game,
	nominee: SeatId,
	characters: CharacterLookup
): ReminderId[] {
	const alignment = alignmentOf(game, nominee);
	if (alignment === undefined) return [];
	return waitingOnNomination(game, characters)
		.filter(({ end }) => end.nominated === alignment)
		.map(({ reminder }) => reminder.reminderId);
}

/**
 * The reminders still on the board that wait on a nomination (the Bishop's): nominations may
 * not end while one is on.
 */
export function nominationsUnfinished(game: Game, characters: CharacterLookup): ReminderInstance[] {
	return waitingOnNomination(game, characters).map(({ reminder }) => reminder);
}

function waitingOnNomination(game: Game, characters: CharacterLookup) {
	return game.seating.flatMap((seatId) =>
		game.seats[seatId].reminders.flatMap((reminder) => {
			const end = reminderEndOf(reminder, characters);
			return typeof end === 'object' ? [{ reminder, end }] : [];
		})
	);
}

/** The moments the day turns: a New day (Dawn) and the night's Dusk step. */
export type DayTurn = 'dawn' | 'dusk';

/** The reminders on the board that come off at `turn`, in seating order. */
export function remindersEndingAt(
	game: Game,
	turn: DayTurn,
	characters: CharacterLookup
): ReminderId[] {
	const kept = keptByJinx(game, characters);
	const days = game.pastDays.length;
	return game.seating.flatMap((seatId) =>
		game.seats[seatId].reminders.flatMap((r) => {
			const at = reminderEndOf(r, characters);
			const effective = at === 'dawn' && kept.has(tokenKey(r.characterId, r.label)) ? 'dusk' : at;
			return endsAt(effective, r.placedDays, days, turn) ? [r.reminderId] : [];
		})
	);
}

/**
 * The reminders that have run out by this dawn (before the New day starts it): those that
 * come off at dawn, and those whose dusk has passed since they were placed, which stayed on
 * because the Storyteller takes them off themselves (Settings, Remove reminders that run out:
 * Ask at dawn to remove, Trevor 2026-11-03). A dusk token counts once a dawn came between its
 * placing and this one; one with no placing day counts at once.
 */
export function remindersRunOutByDawn(game: Game, characters: CharacterLookup): ReminderId[] {
	const days = game.pastDays.length;
	const dawn = new Set(remindersEndingAt(game, 'dawn', characters));
	return game.seating.flatMap((seatId) =>
		game.seats[seatId].reminders.flatMap((r) => {
			if (dawn.has(r.reminderId)) return [r.reminderId];
			const end = reminderEndOf(r, characters);
			const duskPassed = r.placedDays === undefined || r.placedDays < days;
			return (end === 'dusk' || end === 'dusk-after-dawn') && duskPassed ? [r.reminderId] : [];
		})
	);
}

/**
 * The reminders on the board that come off now that `seatId` has died: those that last until
 * a player of their character dies (`owner-dies`), when that seat is the token's owner.
 */
export function remindersEndingOnDeath(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): ReminderId[] {
	return game.seating.flatMap((holder) =>
		game.seats[holder].reminders.flatMap((r) => {
			if (reminderEndOf(r, characters) !== 'owner-dies') return [];
			const owner =
				r.ownerSeatId !== undefined
					? r.ownerSeatId === seatId
					: ownerSeats(game, r.characterId, characters).includes(seatId);
			return owner ? [r.reminderId] : [];
		})
	);
}

/**
 * Whether a token that ends at `end`, placed with `placed` days begun, comes off at `turn`
 * with `days` days begun. A `dusk-after-dawn` token stays through the dusk of the day it was
 * placed (or tonight's Dusk step, ticked after the Storyteller placed it) and comes off at the
 * first dusk after a dawn; one without a placing day (saved
 * before it was recorded) comes off at the next dusk.
 */
function endsAt(
	end: ReminderEndRule | undefined,
	placed: number | undefined,
	days: number,
	turn: DayTurn
): boolean {
	if (end === 'dawn' || end === 'dusk') return end === turn;
	if (end === 'dusk-after-dawn') return turn === 'dusk' && (placed === undefined || placed < days);
	return false;
}

function tokenKey(characterId: string, label: string): string {
	return `${characterId}:${label.toLowerCase()}`;
}

/**
 * The tokens a jinx of a character in play reads by day (`endsGame.token`, the Monk's Safe
 * with the Riot or the Leviathan), as `character:label`.
 */
function keptByJinx(game: Game, characters: CharacterLookup): Set<string> {
	const owners = new Set(game.seating.flatMap((id) => trueCharacter(game, id, characters) ?? []));
	return new Set(
		[...owners].flatMap((owner) =>
			ownJinxes(game, owner, (rule) => rule.endsGame?.token !== undefined, characters).map(
				({ partner, rule }) => tokenKey(partner, rule.endsGame!.token!)
			)
		)
	);
}

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
 */
import type { ReminderEnd } from '#lib/core/data/parts/reminder-ends.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, ReminderId, ReminderInstance, SeatId } from '#lib/core/model/types.ts';
import { ownJinxes } from './jinxes.ts';
import { ownerSeats } from './reminder-targets.ts';

export type { ReminderEnd };

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
			const at = endOf(r, characters);
			const effective = at === 'dawn' && kept.has(tokenKey(r.characterId, r.label)) ? 'dusk' : at;
			return endsAt(effective, r.placedDays, days, turn) ? [r.reminderId] : [];
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
			if (endOf(r, characters) !== 'owner-dies') return [];
			const owner =
				r.ownerSeatId !== undefined
					? r.ownerSeatId === seatId
					: ownerSeats(game, r.characterId, characters).includes(seatId);
			return owner ? [r.reminderId] : [];
		})
	);
}

/** When the reminder's rules say it comes off, if they do. */
function endOf(r: ReminderInstance, characters: CharacterLookup): ReminderEnd | undefined {
	const ends = rulesOf(r.characterId, characters)?.reminderEnds;
	if (!ends) return undefined;
	const label = r.label.toLowerCase();
	const key = Object.keys(ends).find((l) => l.toLowerCase() === label);
	return key === undefined ? undefined : ends[key];
}

/**
 * Whether a token that ends at `end`, placed with `placed` days begun, comes off at `turn`
 * with `days` days begun. A `dusk-after-dawn` token stays through the dusk of the day it was
 * placed (or tonight's Dusk step, ticked after the Storyteller placed it) and comes off at the
 * first dusk after a dawn; one without a placing day (saved
 * before it was recorded) comes off at the next dusk.
 */
function endsAt(
	end: ReminderEnd | undefined,
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

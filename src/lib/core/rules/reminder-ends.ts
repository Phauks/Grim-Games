/**
 * Reminders that come off by themselves (`reminderEnds` in a character's rules block): at the
 * next Dawn (a New day) or the next Dusk (the night's first step, ticked when the day ends).
 * The Monk's Safe comes off at dawn (https://wiki.bloodontheclocktower.com/Monk), and the
 * Poisoner's Poisoned player is healthy again at dusk the next day
 * (https://wiki.bloodontheclocktower.com/Poisoner).
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

/** The reminders on the board that come off at `end`, in seating order. */
export function remindersEndingAt(
	game: Game,
	end: ReminderEnd,
	characters: CharacterLookup
): ReminderId[] {
	const kept = keptByJinx(game, characters);
	return game.seating.flatMap((seatId) =>
		game.seats[seatId].reminders.flatMap((r) => {
			const at = reminderEndOf(r, characters);
			const label = r.label.toLowerCase();
			const effective = at === 'dawn' && kept.has(tokenKey(r.characterId, label)) ? 'dusk' : at;
			return effective === end ? [r.reminderId] : [];
		})
	);
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

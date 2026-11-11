import {
	list,
	NUM,
	obj,
	oneOf,
	opt,
	optObj,
	STR,
	T,
	TOKEN,
	TOKENS,
	variants,
	type SpecValue
} from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * Who may get the token, read from the grimoire:
 * - `any`: any player;
 * - `good` / `evil`: by the seat's alignment;
 * - `townsfolk` / `outsider` / `minion` / `demon`: by the true character's type;
 * - `not-demon`: any player whose true character isn't a Demon;
 * - `same-alignment`: a player of this character's alignment;
 * - `copies`: one of the players who have this character (Village Idiots);
 * - `nearest-townsfolk-anticlockwise` / `-clockwise`: the nearest Townsfolk that way round
 *   from this character, alive or dead (No Dashii, `nearestOfType`).
 */
const SEAT_FILTER = oneOf([
	'any',
	'good',
	'evil',
	'townsfolk',
	'outsider',
	'minion',
	'demon',
	'not-demon',
	'same-alignment',
	'copies',
	'nearest-townsfolk-anticlockwise',
	'nearest-townsfolk-clockwise'
]);
export type SeatFilter = SpecValue<typeof SEAT_FILTER>;

/**
 * - `{ self: true }`: on this character's own seat (the Drunk's "Is The Drunk");
 * - `{ choose, choice }`: on a player the Storyteller picks. `choose` filters the candidates;
 *   when exactly one player fits, the app pre-fills them. `choice` is the short hint shown
 *   when it can't. `notSelf` leaves out this character's own seat. A player already
 *   pre-filled for an earlier token of the same character is left out too.
 */
const TARGET = variants(
	{ label: 'Its player', has: 'self', spec: obj({ self: T }) },
	{
		label: 'A chosen player',
		has: 'choose',
		spec: obj({ choose: SEAT_FILTER, choice: STR, notSelf: opt(T) })
	}
);
export type SetupTarget = SpecValue<typeof TARGET>;

/** At least or exactly so many Outsiders in play, or at least so many copies of it. */
const CONDITION = optObj({ minOutsiders: NUM, exactOutsiders: NUM, minCopies: NUM });
export type SetupCondition = SpecValue<typeof CONDITION>;

const TIMING = oneOf(['setup', 'first-day']);
export type SetupTiming = SpecValue<typeof TIMING>;

/**
 * A token to place: `text` is what the Storyteller does, as one short line with the token in
 * [brackets] (tokens of one character with the same text are one step: the Knight's 2 KNOW
 * tokens). `timing` is `setup` (the default) before the first night, or `first-day` at the
 * start of the first day. `first` lists it before every other setup reminder, as too important
 * to miss (the Drunk's).
 */
const REMINDER = obj({
	label: TOKEN,
	text: STR,
	target: TARGET,
	reason: STR,
	timing: opt(TIMING),
	when: opt(CONDITION),
	first: opt(T)
});
export type SetupReminderSpec = SpecValue<typeof REMINDER>;

/**
 * Preparation that is not a token placement. `value`: a value the Storyteller types in during
 * prep and the app shows later (the Yaggababble's phrase in its pre-day reminder), stored as
 * `Game.prepValues`. With `character: 'good'` it is a good character from the script instead
 * of words (the Storm Catcher's named character), stored by id, chosen whether or not it is in
 * play.
 */
const NOTE = obj({
	text: STR,
	tokens: opt(TOKENS),
	value: opt(obj({ key: STR, label: STR, character: opt(oneOf(['good'])) }))
});
export type SetupNote = SpecValue<typeof NOTE>;

/**
 * What the Storyteller prepares for a character between the draw and the first night: the
 * `setupPrep` part of its rules block, read here and suggested by `rules/setup/setup-reminders.ts`.
 *
 * - `reminders`: tokens the Storyteller places before the first night (or at the start of the
 *   first day). Only tokens the Storyteller decides are listed: a token marking what a player
 *   chooses at night is placed when they choose.
 * - `notes`: other preparation that is not a token placement (words to choose, bluffs to set
 *   aside), with any token the step may use.
 * - `none`: why a character with reminder tokens places none at setup, so the app knows it
 *   has been checked (a custom character with tokens and no `setupPrep` is flagged).
 *
 * `reason` and `none` are our own summaries, never wiki prose.
 */
export const setupPrep = specPart(
	'Setup preparation',
	'Tokens and steps to prepare before the first night.',
	optObj({ reminders: list(REMINDER), notes: list(NOTE), none: STR })
);

export type SetupPrepRules = PartValue<typeof setupPrep>;

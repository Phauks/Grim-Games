/**
 * Where the Character reference table shows each piece of a character's data (Trevor,
 * 2026-10-19: "verify we include all relevant info in the table, and lint to prevent any
 * further failures"). Every key of `Character` and of `ReferenceEntry` must be listed, so
 * a new piece of data fails the typecheck until it gets a column or a stated reason not
 * to; `coverage.test.ts` checks the columns exist and that TPI's data carries nothing else.
 */
import type { Character } from '#lib/core/data/index.ts';
import type { ReferenceEntry } from '#lib/core/rules/reference.ts';
import type { FieldId } from './fields.ts';

/** The column that shows it, or why no column does. */
export type Shown = FieldId | { notShown: string };

export const CHARACTER_COVERAGE = {
	id: { notShown: 'An internal key; the name and wiki link identify the character.' },
	name: 'name',
	type: 'type',
	edition: 'edition',
	ability: 'ability',
	flavor: 'flavor',
	setup: 'setup',
	reminders: 'tokens',
	remindersGlobal: 'tokens',
	firstNightReminder: 'firstNight',
	otherNightReminder: 'otherNight',
	special: 'special',
	// Custom scripts only; official characters use the synced icons, shown in Icons.
	image: 'icons',
	// Custom scripts only; the official order is shown as steps in the night columns.
	firstNight: 'firstNight',
	otherNight: 'otherNight',
	// Custom scripts only (official blocks are data/rules/<id>.json).
	rules: {
		notShown: 'How the app applies the ability; Inspect is to show the whole rules block (planned).'
	}
} as const satisfies Record<keyof Character, Shown>;

export const ENTRY_COVERAGE = {
	character: { notShown: 'The character itself, covered key by key above.' },
	alignment: 'alignment',
	alignmentNote: 'alignment',
	setup: 'setup',
	tokens: 'tokens',
	jinxes: 'jinxes',
	firstNight: 'firstNight',
	otherNight: 'otherNight',
	dayReminders: 'preDay',
	noDayReason: 'preDay',
	differences: {
		notShown: 'Parked with SHOW_DIFFERS_FROM_SOURCE (night-text.ts, Trevor 2026-10-15).'
	},
	// The wiki link sits under the name.
	wiki: 'name',
	problems: 'problems',
	filters: { notShown: 'Derived from the fields above, for filtering only.' }
} as const satisfies Record<keyof ReferenceEntry, Shown>;

/**
 * Columns built from other data rather than one key: the token picture, its setup
 * preparation (`setupPrep`) and the character's info cards (`characterCardsFor`).
 */
export const DERIVED_FIELDS: readonly FieldId[] = ['token', 'prep', 'cards'];

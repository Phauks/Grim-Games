import {
	list,
	obj,
	oneOf,
	opt,
	optObj,
	ownWords,
	STR,
	T,
	TOKEN,
	type SpecValue
} from '../field-spec.ts';
import { specPart, type PartValue, partWords } from './part.ts';

/** One `:reminder:`: the tokens it handles, or `either` when only one of them applies. */
const PLACEHOLDER = obj({
	tokens: list(obj({ label: TOKEN, action: oneOf(['place', 'remove']) })),
	either: opt(T)
});

export type ReminderPlaceholder = SpecValue<typeof PLACEHOLDER>;
export type PlaceholderToken = ReminderPlaceholder['tokens'][number];
export type PlaceholderAction = PlaceholderToken['action'];

/**
 * What each `:reminder:` in a character's night text means (Trevor, 2026-10-15: ":reminder:
 * ... defers to the first reminder token, which is not always proper. see pukka"): the
 * `reminderPlaceholders` part of its rules block, read here and used by `rules/night/night-text.ts`
 * and the night walk-through.
 *
 * TPI's text marks where a reminder token is handled with a bare `:reminder:`; it never says
 * which token, or whether it goes on or comes off. `first` and `other` say so for every
 * occurrence in that night's text, one entry per `:reminder:` in text order:
 * - `tokens`: the reminder tokens (the character's own reminder names);
 * - each token's `action`: `place` puts it on a player, `remove` takes it off;
 * - `either`: only one of the tokens applies, depending on what happens (the Barista's two
 *   effects, the Po's single kill or charge).
 *
 * `note` says what the mapping encodes, in our own words. Each mapping was decided from the
 * character's wiki page (the rules authority).
 */
export const reminderPlaceholders = partWords(
	specPart(
		'tokens',
		'Night text reminders',
		'What each reminder named in its night text means.',
		optObj({ first: list(PLACEHOLDER), other: list(PLACEHOLDER), note: ownWords(STR) }),
		(value, path, issues) => {
			const empty = (['first', 'other'] as const).flatMap((night) =>
				(value[night] ?? []).flatMap((p, i) =>
					p.tokens.length ? [] : [`${path}.${night}[${i}].tokens`]
				)
			);
			for (const at of empty) issues.add(at, 'expected a list of tokens');
			return empty.length ? undefined : value;
		}
	),
	{
		first: {
			label: 'First night'
		},
		'first.*.tokens': {
			label: 'Reminders'
		},
		'first.*.tokens.*.label': {
			label: 'Reminder'
		},
		'first.*.tokens.*.action': {
			label: 'Action',
			names: {
				place: 'Place',
				remove: 'Take off'
			}
		},
		'first.*.either': {
			label: 'Either one'
		},
		other: {
			label: 'Other nights'
		},
		'other.*.tokens': {
			label: 'Reminders'
		},
		'other.*.tokens.*.label': {
			label: 'Reminder'
		},
		'other.*.tokens.*.action': {
			label: 'Action',
			names: {
				place: 'Place',
				remove: 'Take off'
			}
		},
		'other.*.either': {
			label: 'Either one'
		}
	}
);

export type ReminderPlaceholderRules = PartValue<typeof reminderPlaceholders>;

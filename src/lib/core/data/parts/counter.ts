import { obj, oneOf, opt, T, TOKENS } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

export const COUNTER_TIMES = ['dawn', 'dusk'] as const;
export type CounterTime = (typeof COUNTER_TIMES)[number];

/**
 * The `counter` part of a character's rules block (plan M53, Trevor 2026-11-04: "certain
 * tokens stack on each other, they are relational ... make these automatically tick up"): a run
 * of the character's own reminders, one for each day or night, that the Storyteller adds as the
 * game goes on. `tokens` lists them in order; `at` says when the next one goes on: `dawn` for a
 * day counter (the Leviathan's and the Riot's Day tokens), `dusk` for a night counter (the
 * Summoner's and the Xaan's Night tokens). `replaces` takes the one before off, for a character
 * that carries only one at a time (the Leviathan). Moved by `rules/counters.ts`, as the
 * Storyteller's setting says.
 */
export const counter = specPart(
	'Counter',
	'Its run of day or night tokens gains the next one each dawn or dusk.',
	obj({ tokens: TOKENS, at: oneOf(COUNTER_TIMES), replaces: opt(T) }),
	(value, path, issues) => {
		if (value.tokens.length >= 2) return value;
		issues.add(`${path}.tokens`, 'expected two or more reminders, in the order placed');
		return undefined;
	}
);

export type Counter = PartValue<typeof counter>;

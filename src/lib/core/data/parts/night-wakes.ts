import {
	anyOf,
	CHARACTERS,
	COUNT,
	list,
	obj,
	oneOf,
	opt,
	ownWords,
	STR,
	T,
	type SpecValue
} from '../field-spec.ts';
import { SEATED_TYPES } from '../types.ts';
import { specPart } from './part.ts';

/**
 * Players a rule source wakes at night, on top of the night order: these `characters` or
 * `types`, or with `dead` every dead player together (Council of the Dead,
 * https://beardytas.com/garden-of-djinn/council-of-the-dead/), on the nights `when` says
 * (`night` for `one-night`, 1 being the first), for `minutes` when given. With `chosen`, one
 * player the Storyteller picks (The Ballad of Seat 7's Grandmother Principle,
 * https://beardytas.com/garden-of-djinn/the-ballad-of-seat-7/). `text` is the step's own line,
 * else the rule's.
 */
const WAKE = obj({
	when: oneOf(['each-night', 'each-night-except-first', 'one-night']),
	night: opt(COUNT),
	characters: opt(CHARACTERS),
	types: opt(anyOf(SEATED_TYPES)),
	dead: opt(T),
	chosen: opt(T),
	minutes: opt(COUNT),
	text: opt(ownWords(STR))
});
export type NightWake = SpecValue<typeof WAKE>;

/** Players it wakes at night, on top of the night order (`features/grimoire/night/night-steps.ts`). */
export const nightWakes = specPart(
	'night',
	'Night wakes',
	'Players it wakes at night, on top of the night order.',
	list(WAKE),
	(value, path, issues) => {
		const unset = value.flatMap((w, i) => (w.when === 'one-night' && !w.night ? [i] : []));
		for (const i of unset) issues.add(`${path}[${i}].night`, 'missing');
		return unset.length ? undefined : value;
	}
);

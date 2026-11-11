import { obj, oneOf, opt, TOKEN } from '../field-spec.ts';
import { CHARACTER_TYPES } from '../types.ts';
import { specPart, type PartValue } from './part.ts';

/** A reminder token and, when given, the only character type it works on. */
export const TOKEN_ON_TYPE = obj({ token: TOKEN, type: opt(oneOf(CHARACTER_TYPES)) });

/**
 * The `stopsWaking` part of a character's rules block: its reminder token on a player stops
 * that player waking for their own ability tonight, only a `type` player when given (the
 * Exorcist's Chosen on the Demon, https://wiki.bloodontheclocktower.com/Exorcist). Shown at
 * the stopped step (`rules/night-alerts.ts`).
 */
export const stopsWaking = specPart(
	'Stops waking',
	'Its token on a player stops them waking tonight.',
	TOKEN_ON_TYPE
);

export type StopsWaking = PartValue<typeof stopsWaking>;

import { obj, TOKENS } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * The `countdown` part of a character's rules block: a reminder token that counts down one
 * step each night, so an effect lasts a set number of nights and days. `tokens` lists the
 * labels in the order they are placed: each night the token on a player is swapped for the
 * next, and the last one comes off. The Courtier's drunkenness lasts 3 nights and 3 days
 * (https://wiki.bloodontheclocktower.com/Courtier), marked Drunk 1, then Drunk 2, then Drunk 3,
 * as its How to Run says. Shown at the character's night step (`rules/reminders/countdown.ts`).
 */
export const countdown = specPart(
	'Countdown',
	'Its token counts down one step a night.',
	obj({ tokens: TOKENS }),
	(value, path, issues) => {
		if (value.tokens.length >= 2) return value;
		issues.add(`${path}.tokens`, 'expected two or more reminders, in the order placed');
		return undefined;
	}
);

export type Countdown = PartValue<typeof countdown>;

import { oneOf, optObj, T } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * How the whole table votes, while the character's ability works:
 * - `voters: "self-and-dead"`: only its own player and the dead may vote on a nomination
 *   (exiles are untouched);
 * - `deadNeedNoToken`: the dead vote without their vote token, and voting spends none;
 * - `noMajority`: no half of the living is needed: the nominee with the most votes is
 *   executed, ties as usual (all three are the Voudon,
 *   https://wiki.bloodontheclocktower.com/Voudon);
 * - `secret`: everyone votes with eyes closed and the tally is never announced (the Organ
 *   Grinder, https://wiki.bloodontheclocktower.com/Organ_Grinder);
 * - `deadRegainToken: "final-day"`: every dead player gets their vote token back on the day
 *   the Storyteller calls the final day (the Ferryman,
 *   https://wiki.bloodontheclocktower.com/Ferryman).
 */
export const voting = specPart(
	'day',
	'How the table votes',
	'Changes who may vote, whether ghost votes are spent, the votes needed, secrecy or vote tokens, for everyone.',
	optObj({
		voters: oneOf(['self-and-dead']),
		deadNeedNoToken: T,
		noMajority: T,
		secret: T,
		deadRegainToken: oneOf(['final-day'])
	}),
	(value, path, issues) => {
		if (Object.keys(value).length > 0) return value;
		issues.add(path, 'expected voters, deadNeedNoToken, noMajority, secret or deadRegainToken');
		return undefined;
	}
);

export type Voting = PartValue<typeof voting>;

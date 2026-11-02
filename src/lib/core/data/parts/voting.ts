import { checkKeys, describe, isObject, readBoolean, readEnum } from '../validate.ts';
import { objectPart } from './part.ts';

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
export interface Voting {
	voters?: 'self-and-dead';
	deadNeedNoToken?: true;
	noMajority?: true;
	secret?: true;
	deadRegainToken?: 'final-day';
}

const FLAGS = ['deadNeedNoToken', 'noMajority', 'secret'] as const;

export const voting = objectPart(
	'How the table votes',
	'Changes who may vote, whether ghost votes are spent, the votes needed, secrecy or vote tokens, for everyone.',
	(raw, path, issues): Voting | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['voters', ...FLAGS, 'deadRegainToken'], path, issues);
		const out: Voting = {};
		let ok = true;
		const voters = readEnum(raw, 'voters', ['self-and-dead'] as const, path, issues, false);
		if (voters !== undefined) out.voters = voters;
		else if (raw.voters !== undefined) ok = false;
		for (const key of FLAGS) {
			const value = readBoolean(raw, key, path, issues);
			if (value === true) out[key] = true;
			else if (value === false) {
				issues.add(`${path}.${key}`, 'expected true');
				ok = false;
			}
		}
		const regain = readEnum(raw, 'deadRegainToken', ['final-day'] as const, path, issues, false);
		if (regain !== undefined) out.deadRegainToken = regain;
		else if (raw.deadRegainToken !== undefined) ok = false;
		if (Object.keys(out).length === 0 && ok) {
			issues.add(path, 'expected voters, deadNeedNoToken, noMajority, secret or deadRegainToken');
			ok = false;
		}
		return ok ? out : undefined;
	}
);

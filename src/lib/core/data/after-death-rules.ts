/**
 * What a player may still do once dead (`afterDeath` in a rules block): nominate, and vote
 * with no vote token, after a death of a given cause (the Banshee killed by the Demon,
 * https://wiki.bloodontheclocktower.com/Banshee). Read by `rules/nominations.ts` and
 * `rules/voting.ts`.
 */
import type { DeathCauseMatch } from './day-reminder-rules.ts';
import { SEATED_TYPES, type SeatedType } from './types.ts';
import { checkKeys, describe, isObject, readEnum, readNumber, type Issues } from './validate.ts';

export interface AfterDeath {
	cause: readonly DeathCauseMatch[];
	/** Nominations a day (the living make one; the dead none). */
	nominations?: number;
	/** Votes on every nomination, needing no vote token. */
	votes?: number;
}

export function readAfterDeath(raw: unknown, at: string, issues: Issues): AfterDeath | undefined {
	if (!isObject(raw)) {
		issues.add(at, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['cause', 'nominations', 'votes'], at, issues);
	const cause = raw.cause;
	const causes =
		Array.isArray(cause) &&
		cause.length > 0 &&
		cause.every((c) => typeof c === 'string' && c !== '')
			? (cause as string[])
			: undefined;
	if (!causes) issues.add(`${at}.cause`, 'expected a list of death causes or character ids');
	const out: Partial<AfterDeath> = {};
	for (const key of ['nominations', 'votes'] as const) {
		const n = readNumber(raw, key, at, issues);
		if (n === undefined) continue;
		if (!Number.isInteger(n) || n < 1)
			issues.add(`${at}.${key}`, 'expected a whole number, 1 or more');
		else out[key] = n;
	}
	if (out.nominations === undefined && out.votes === undefined)
		issues.add(at, 'expected nominations or votes');
	return causes && (out.nominations !== undefined || out.votes !== undefined)
		? { cause: causes, ...out }
		: undefined;
}

/**
 * The `reincarnates` part of a rules block: the first `first` players to die are at once
 * reborn as Travellers the Storyteller picks, alive, keeping their alignment (the Hindu,
 * https://wiki.bloodontheclocktower.com/Hindu). Read by `rules/reincarnation.ts`.
 *
 * `demonTo`: a Demon among them may be reborn too, and then a living player of this type
 * becomes that Demon (the Hindu's optional rule: a Minion). Without it, a Demon is not reborn.
 */
export interface Reincarnates {
	first: number;
	demonTo?: SeatedType;
}

export function readReincarnates(
	raw: unknown,
	at: string,
	issues: Issues
): Reincarnates | undefined {
	if (!isObject(raw)) {
		issues.add(at, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['first', 'demonTo'], at, issues);
	const first = readNumber(raw, 'first', at, issues);
	const demonTo = readEnum(raw, 'demonTo', SEATED_TYPES, at, issues, false);
	if (first === undefined || !Number.isInteger(first) || first < 1) {
		issues.add(`${at}.first`, 'expected a whole number, 1 or more');
		return undefined;
	}
	return { first, ...(demonTo ? { demonTo } : {}) };
}

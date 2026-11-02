import type { ReminderLabel } from '../types.ts';
import { readToken } from '../reminder-fields.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readEnum,
	readNumber,
	type Issues
} from '../validate.ts';
import { objectPart } from './part.ts';

const KILLS_BY = ['demon', 'other'] as const;
const KILLS_TARGETS = ['any', 'self'] as const;
export interface Kills {
	by: (typeof KILLS_BY)[number];
	targets?: (typeof KILLS_TARGETS)[number];
	ignoresProtection?: boolean;
	/** How many players it may choose a night; 1 when not given. */
	count?: number;
	/** With its own `token` on its player (it chose no one), it may choose `count` instead. */
	charged?: { token: ReminderLabel; count: number };
	/** Its kill falls on the player carrying this token of its own, and needs no waking. */
	delayed?: ReminderLabel;
}

/**
 * The ability kills at night: the Demon's kill or another ability's (`by`), any player or
 * only its own (`targets: self`, the Gambler), and ignoring protection (the Assassin). `count`
 * players a night (the Shabaloth's 2), or `charged.count` while its `charged.token` is on its
 * player (the Po's 3 Attacks after choosing no one); a `delayed` kill falls on the carrier of
 * its token though it does not wake (the Pukka's Poisoned) (`rules/night-kill.ts`).
 */
export const kills = objectPart(
	'Kills',
	'The ability kills at night.',
	(raw, path, issues, reminders): Kills | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(
			raw,
			['by', 'targets', 'ignoresProtection', 'count', 'charged', 'delayed'],
			path,
			issues
		);
		const by = readEnum(raw, 'by', KILLS_BY, path, issues, true);
		const targets = readEnum(raw, 'targets', KILLS_TARGETS, path, issues, false);
		const ignoresProtection = readBoolean(raw, 'ignoresProtection', path, issues);
		if (!by) return undefined;
		const out: Kills = { by };
		if (targets) out.targets = targets;
		if (ignoresProtection !== undefined) out.ignoresProtection = ignoresProtection;
		const count = readCount(raw, 'count', path, issues);
		if (count !== undefined) out.count = count;
		const delayed = readToken(raw, 'delayed', path, issues, reminders);
		if (delayed) out.delayed = delayed;
		if (raw.charged !== undefined) {
			const at = `${path}.charged`;
			if (!isObject(raw.charged)) {
				issues.add(at, `expected object, got ${describe(raw.charged)}`);
			} else {
				checkKeys(raw.charged, ['token', 'count'], at, issues);
				if (raw.charged.token === undefined) issues.add(`${at}.token`, 'missing');
				if (raw.charged.count === undefined) issues.add(`${at}.count`, 'missing');
				const token = readToken(raw.charged, 'token', at, issues, reminders);
				const charged = readCount(raw.charged, 'count', at, issues);
				if (token && charged !== undefined) out.charged = { token, count: charged };
			}
		}
		return out;
	}
);

/** A whole number of players, at least 1. */
function readCount(
	raw: Record<string, unknown>,
	key: string,
	path: string,
	issues: Issues
): number | undefined {
	const n = readNumber(raw, key, path, issues);
	if (n === undefined) return undefined;
	if (!Number.isInteger(n) || n < 1) {
		issues.add(`${path}.${key}`, `expected a whole number from 1, got ${n}`);
		return undefined;
	}
	return n;
}

/**
 * The `impairs` part of a character's rules block: how its ability leaves players drunk,
 * poisoned or with no ability, read here and worked out in `rules/ability.ts`.
 */
import { ownReminder } from './reminder-fields.ts';
import { CHARACTER_TYPES, type CharacterType, type ReminderLabel } from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readEnum,
	readNumber,
	readString,
	readStringArray,
	type Issues
} from './validate.ts';

/** Why an ability does not work. `no-ability`: an effect such as the Preacher's. */
const IMPAIRMENT_REASONS = ['drunk', 'poisoned', 'no-ability'] as const;
export type ImpairmentReason = (typeof IMPAIRMENT_REASONS)[number];

/**
 * Who a reminder token impairs: `carrier`, the player it sits on (only a `type` character,
 * and with `whileWorks` only while this character's own ability works: the Preacher's "No
 * Ability"), or `others`, every other player except Travellers while the token is on the
 * board (the Minstrel's "Everyone Is Drunk"), only `type` players when given (the Xaan's "X"
 * poisons every Townsfolk).
 */
const IMPAIRS_ON = ['carrier', 'others'] as const;
export interface TokenImpairment {
	reason: ImpairmentReason;
	on: (typeof IMPAIRS_ON)[number];
	type?: CharacterType;
	whileWorks?: boolean;
	/**
	 * Only while a seat carrying this character's `token` keeps their ability (`keepsAbility`),
	 * and with `nearest` only on that seat's nearest player of that type either way round: the
	 * Vigormortis's Poisoned Townsfolk beside a Minion it killed (M15g).
	 */
	whileKept?: { token: ReminderLabel; nearest?: CharacterType };
}

/**
 * How the ability impairs players. `self`: its own player always is (the Drunk), or once at
 * most `aliveAtMost` players live (the Witch). `tokens`: what each of its reminders does, by
 * label; an entry without `whileWorks` lasts even once this character's ability ends (the
 * Sweetheart's "from now on"). A reminder with no entry here impairs its carrier when its label
 * says "Poisoned" or "Drunk", only while this character's ability works
 * (https://wiki.bloodontheclocktower.com/Abilities). `clears`: its reminders that make their
 * carrier sober and healthy while its ability works (the Barista's "Sober & Healthy").
 */
export interface Impairs {
	self?: { reason: ImpairmentReason; aliveAtMost?: number };
	tokens?: Readonly<Record<ReminderLabel, TokenImpairment>>;
	clears?: readonly ReminderLabel[];
}

function readWhileKept(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): TokenImpairment['whileKept'] {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['token', 'nearest'], path, issues);
	const token = readString(raw, 'token', path, issues, true);
	const nearest = readEnum(raw, 'nearest', CHARACTER_TYPES, path, issues, false);
	if (token === undefined) return undefined;
	if (!ownReminder(token, reminders)) {
		issues.add(`${path}.token`, 'not one of this character’s reminders');
		return undefined;
	}
	return { token, ...(nearest ? { nearest } : {}) };
}

export function readImpairs(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): Impairs | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['self', 'tokens', 'clears'], path, issues);
	const out: Impairs = {};
	if (raw.clears !== undefined) {
		const clears = readStringArray(raw, 'clears', path, issues);
		const own = clears?.filter((label) => {
			if (ownReminder(label, reminders)) return true;
			issues.add(
				`${path}.clears`,
				`${JSON.stringify(label)} is not one of this character’s reminders`
			);
			return false;
		});
		if (own && own.length === clears?.length) out.clears = own;
	}
	if (raw.self !== undefined) {
		const at = `${path}.self`;
		if (!isObject(raw.self)) {
			issues.add(at, `expected object, got ${describe(raw.self)}`);
		} else {
			checkKeys(raw.self, ['reason', 'aliveAtMost'], at, issues);
			const reason = readEnum(raw.self, 'reason', IMPAIRMENT_REASONS, at, issues, true);
			const aliveAtMost = readNumber(raw.self, 'aliveAtMost', at, issues);
			if (reason) out.self = { reason, ...(aliveAtMost !== undefined ? { aliveAtMost } : {}) };
		}
	}
	if (raw.tokens !== undefined) {
		const at = `${path}.tokens`;
		if (!isObject(raw.tokens)) {
			issues.add(at, `expected object, got ${describe(raw.tokens)}`);
		} else {
			const tokens: Record<ReminderLabel, TokenImpairment> = {};
			for (const [label, value] of Object.entries(raw.tokens)) {
				const here = `${at}.${label}`;
				if (!ownReminder(label, reminders)) {
					issues.add(here, 'not one of this character’s reminders');
					continue;
				}
				if (!isObject(value)) {
					issues.add(here, `expected object, got ${describe(value)}`);
					continue;
				}
				checkKeys(value, ['reason', 'on', 'type', 'whileWorks', 'whileKept'], here, issues);
				const reason = readEnum(value, 'reason', IMPAIRMENT_REASONS, here, issues, true);
				const on = readEnum(value, 'on', IMPAIRS_ON, here, issues, true);
				const type = readEnum(value, 'type', CHARACTER_TYPES, here, issues, false);
				const whileWorks = readBoolean(value, 'whileWorks', here, issues);
				const whileKept =
					value.whileKept === undefined
						? undefined
						: readWhileKept(value.whileKept, `${here}.whileKept`, issues, reminders);
				if (!reason || !on) continue;
				tokens[label] = {
					reason,
					on,
					...(type ? { type } : {}),
					...(whileWorks !== undefined ? { whileWorks } : {}),
					...(whileKept ? { whileKept } : {})
				};
			}
			out.tokens = tokens;
		}
	}
	return out;
}

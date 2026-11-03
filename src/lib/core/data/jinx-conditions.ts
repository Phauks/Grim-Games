/**
 * The `when` conditions of a jinx effect (`jinx-rules.ts` documents each), and their reader.
 * Split from the format so it stays one module per concern; `jinx-when.ts` says whether each
 * holds.
 */
import { ALIGNMENTS, type Alignment, type ReminderLabel } from './types.ts';
import {
	describe,
	isObject,
	readEnum,
	readNumber,
	readString,
	type Issues,
	type Json
} from './validate.ts';

export const JINX_FLAGS = [
	'self-alive',
	'partner-alive',
	'self-in-play',
	'partner-in-play',
	'has-partner-ability',
	'partner-has-this-ability',
	'after-execution',
	'final-day'
] as const;
export type JinxFlag = (typeof JINX_FLAGS)[number];

/** A `when` condition: a flag, or one keyed number or reminder label. */
export type JinxCondition =
	| JinxFlag
	| { afterDay: number }
	| { day: number }
	| { night: number }
	| { marked: ReminderLabel }
	| { partnerMarked: ReminderLabel }
	| { alignment: Alignment }
	| { partnerAlignment: Alignment };

const NUMBER_CONDITIONS = ['afterDay', 'day', 'night'] as const;
const LABEL_CONDITIONS = ['marked', 'partnerMarked'] as const;
const ALIGNMENT_CONDITIONS = ['alignment', 'partnerAlignment'] as const;

export /** A whole number of 1 or more, with an issue when it is missing or isn't one. */
function readPositive(raw: Json, key: string, path: string, issues: Issues): number | undefined {
	const value = readNumber(raw, key, path, issues);
	if (raw[key] === undefined) {
		issues.add(`${path}.${key}`, 'missing');
		return undefined;
	}
	if (value === undefined) return undefined;
	if (!Number.isInteger(value) || value < 1) {
		issues.add(`${path}.${key}`, 'expected a whole number of 1 or more');
		return undefined;
	}
	return value;
}

/** One `when` condition, or undefined (with an issue) when it is not one. */
export function readCondition(
	raw: unknown,
	path: string,
	issues: Issues
): JinxCondition | undefined {
	if (typeof raw === 'string') {
		if ((JINX_FLAGS as readonly string[]).includes(raw)) return raw as JinxFlag;
		issues.add(path, `unknown condition ${JSON.stringify(raw)}`);
		return undefined;
	}
	const keys = isObject(raw) ? Object.keys(raw) : [];
	if (!isObject(raw) || keys.length !== 1) {
		issues.add(path, `expected a condition, got ${describe(raw)}`);
		return undefined;
	}
	const [key] = keys;
	if ((NUMBER_CONDITIONS as readonly string[]).includes(key)) {
		const n = readPositive(raw, key, path, issues);
		return n === undefined ? undefined : ({ [key]: n } as JinxCondition);
	}
	if ((LABEL_CONDITIONS as readonly string[]).includes(key)) {
		const label = readString(raw, key, path, issues, true);
		return label === undefined ? undefined : ({ [key]: label } as JinxCondition);
	}
	if ((ALIGNMENT_CONDITIONS as readonly string[]).includes(key)) {
		const alignment = readEnum(raw, key, ALIGNMENTS, path, issues, true);
		return alignment === undefined ? undefined : ({ [key]: alignment } as JinxCondition);
	}
	issues.add(`${path}.${key}`, 'unknown condition');
	return undefined;
}

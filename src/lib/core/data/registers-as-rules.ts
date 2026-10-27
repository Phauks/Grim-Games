/**
 * Reads the `registersAs` part of a character's rules block (types in `character-rules.ts`):
 * the Spy and Recluse themselves, and tokens such as the Lycanthrope's Faux Paw on a carrier.
 */
import type { RegistersAs, TokenRegisters } from './character-rules.ts';
import { ownReminder, readToken } from './reminder-fields.ts';
import { ALIGNMENTS, CHARACTER_TYPES, type ReminderLabel } from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readEnum,
	readStringArray,
	type Issues
} from './validate.ts';

function readEnumList<T extends string>(
	raw: Record<string, unknown>,
	key: string,
	values: readonly T[],
	path: string,
	issues: Issues
): T[] | undefined {
	const list = readStringArray(raw, key, path, issues);
	if (!list) return undefined;
	const bad = list.filter((v) => !(values as readonly string[]).includes(v));
	for (const v of bad) issues.add(`${path}.${key}`, `unknown value ${JSON.stringify(v)}`);
	return bad.length > 0 ? undefined : (list as T[]);
}

function readRegisters(
	raw: unknown,
	path: string,
	issues: Issues,
	extra: readonly string[] = [],
	reminders?: readonly ReminderLabel[]
): TokenRegisters | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['alignments', 'types', ...extra], path, issues);
	const out: TokenRegisters = {};
	const alignments = readEnumList(raw, 'alignments', ALIGNMENTS, path, issues);
	if (alignments) out.alignments = alignments;
	const types = readEnumList(raw, 'types', CHARACTER_TYPES, path, issues);
	if (types) out.types = types;
	if (extra.includes('carrierAlignment')) {
		const carrier = readEnum(raw, 'carrierAlignment', ALIGNMENTS, path, issues, false);
		if (carrier) out.carrierAlignment = carrier;
	}
	if (extra.includes('asAnything') && readBoolean(raw, 'asAnything', path, issues))
		out.asAnything = true;
	if (extra.includes('whileToken') && raw.whileToken !== undefined) {
		const token = readToken(raw, 'whileToken', path, issues, reminders);
		if (token) out.whileToken = token;
	}
	return out;
}

export function readRegistersAs(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): RegistersAs | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['self', 'tokens'], path, issues);
	const out: RegistersAs = {};
	if (raw.self !== undefined) {
		const self = readRegisters(raw.self, `${path}.self`, issues);
		if (self) out.self = self;
	}
	if (raw.tokens !== undefined) {
		const at = `${path}.tokens`;
		if (!isObject(raw.tokens)) {
			issues.add(at, `expected object, got ${describe(raw.tokens)}`);
		} else {
			const tokens: Record<ReminderLabel, TokenRegisters> = {};
			for (const [label, value] of Object.entries(raw.tokens)) {
				if (!ownReminder(label, reminders)) {
					issues.add(`${at}.${label}`, 'not one of this character’s reminders');
					continue;
				}
				const rule = readRegisters(
					value,
					`${at}.${label}`,
					issues,
					['carrierAlignment', 'asAnything', 'whileToken'],
					reminders
				);
				if (rule) tokens[label] = rule;
			}
			out.tokens = tokens;
		}
	}
	return out;
}

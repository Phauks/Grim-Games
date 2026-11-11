/**
 * Reads and checks a value against its field spec (`field-spec.ts`): the one reader for every
 * part made with `specPart` (`parts/part.ts`), so a part's shape is written once and the
 * Character builder's fields, the reader and the value's type all come from it (refactor
 * review A1). Each problem is recorded in `issues` under its path, as the hand-written readers
 * do, and a value with any problem reads as undefined.
 */
import { variantOf, type FieldSpec, type SpecValue } from './field-spec.ts';
import { ownReminder } from './reminder-fields.ts';
import type { ReminderLabel } from './types.ts';
import { describe, isObject, type Issues } from './validate.ts';

/** The character's own reminder labels, when known: a value naming any other is an error. */
type Reminders = readonly ReminderLabel[] | undefined;

/** `raw` read as `spec` describes; undefined when it has any problem. */
export function readSpec<S extends FieldSpec>(
	spec: S,
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: Reminders
): SpecValue<S> | undefined {
	const before = issues.list.length;
	const value = read(spec, raw, path, issues, reminders);
	return issues.list.length > before ? undefined : (value as SpecValue<S>);
}

const isWhole = (value: unknown): value is number =>
	typeof value === 'number' && Number.isInteger(value);

function read(
	spec: FieldSpec,
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: Reminders
): unknown {
	const expected = (what: string) => {
		issues.add(path, `expected ${what}, got ${describe(raw)}`);
		return undefined;
	};
	switch (spec.kind) {
		case 'text':
			return raw;
		case 'true':
			// False is the same as leaving the setting out.
			return typeof raw === 'boolean' ? raw || undefined : expected('boolean');
		case 'boolean':
			return typeof raw === 'boolean' ? raw : expected('boolean');
		case 'count':
			if (isWhole(raw) && raw > 0) return raw;
			return typeof raw === 'number'
				? issues.add(path, `expected a whole number above 0, got ${raw}`)
				: expected('number');
		case 'number':
			if (isWhole(raw) && raw >= 0) return raw;
			return typeof raw === 'number'
				? issues.add(path, `expected a whole number, 0 or more, got ${raw}`)
				: expected('number');
		case 'integer':
			if (isWhole(raw)) return raw;
			return typeof raw === 'number'
				? issues.add(path, `expected a whole number, got ${raw}`)
				: expected('number');
		case 'string':
		case 'character':
			return typeof raw === 'string' ? raw : expected('string');
		case 'token':
			if (typeof raw !== 'string') return expected('string');
			if (ownReminder(raw, reminders)) return raw;
			return issues.add(path, 'not one of this character’s reminders');
		case 'enum':
			if (typeof raw === 'string' && spec.values.includes(raw)) return raw;
			return issues.add(path, `unknown value ${JSON.stringify(raw)}`);
		case 'enums':
		case 'strings':
		case 'numbers':
		case 'tokens':
			return readArray(spec, raw, path, issues, reminders);
		case 'list':
			return Array.isArray(raw)
				? raw.map((item, i) => read(spec.of, item, `${path}[${i}]`, issues, reminders))
				: expected('array');
		case 'byToken':
		case 'byKey':
		case 'byCharacter': {
			if (!isObject(raw)) return expected('object');
			const out: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(raw)) {
				if (spec.kind === 'byToken' && !ownReminder(key, reminders)) {
					issues.add(`${path}.${key}`, 'not one of this character’s reminders');
					continue;
				}
				out[key] = read(spec.of, value, `${path}.${key}`, issues, reminders);
			}
			return out;
		}
		case 'variants': {
			const i = variantOf(spec, raw);
			if (i >= 0) return read(spec.variants[i]!.spec, raw, path, issues, reminders);
			const kinds = spec.variants.map((v) => v.label.toLowerCase()).join(', ');
			return issues.add(path, `expected one of: ${kinds}`);
		}
		case 'object': {
			if (!isObject(raw)) return expected('object');
			const known = new Set(spec.fields.map((f) => f.key));
			for (const key of Object.keys(raw)) {
				if (!known.has(key)) issues.add(`${path}.${key}`, 'unknown field');
			}
			const out: Record<string, unknown> = {};
			for (const field of spec.fields) {
				const at = `${path}.${field.key}`;
				if (raw[field.key] === undefined) {
					if (!field.optional) issues.add(at, 'missing');
					continue;
				}
				const value = read(field.spec, raw[field.key], at, issues, reminders);
				if (value !== undefined) out[field.key] = value;
			}
			return out;
		}
	}
}

/** A list of `values`, of text, of whole numbers or of the character's own reminders. */
function readArray(
	spec: Extract<FieldSpec, { kind: 'enums' | 'strings' | 'numbers' | 'tokens' }>,
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: Reminders
): unknown {
	if (!Array.isArray(raw)) {
		issues.add(path, `expected array, got ${describe(raw)}`);
		return undefined;
	}
	raw.forEach((item, i) => {
		const at = `${path}[${i}]`;
		if (spec.kind === 'numbers') {
			if (!isWhole(item)) issues.add(at, `expected a whole number, got ${describe(item)}`);
		} else if (typeof item !== 'string') {
			issues.add(at, `expected string, got ${describe(item)}`);
		} else if (spec.kind === 'enums' && !spec.values.includes(item)) {
			issues.add(at, `unknown value ${JSON.stringify(item)}`);
		}
	});
	if (spec.kind === 'tokens') {
		const foreign = raw.filter((t) => typeof t === 'string' && !ownReminder(t, reminders));
		if (foreign.length) {
			issues.add(path, `not this character’s reminders: ${foreign.join(', ')}`);
		}
	}
	return raw;
}

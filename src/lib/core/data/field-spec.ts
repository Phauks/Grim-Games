/**
 * How the Character builder edits a rule's value (M62): a small description of the value's
 * shape as written in a rules block, from which one form draws the rule's fields. The rule's
 * own reader (`parts/`) still checks the value; this only says which controls to draw.
 */

/** One setting of an object: its key, how it is edited and whether it may be left out. */
export interface ObjectField {
	key: string;
	spec: FieldSpec;
	optional?: true;
}

/**
 * One shape a value may take, told apart from the others by a key it has (`has`) or by being
 * a list, text or an object (`is`).
 */
export interface Variant {
	label: string;
	has?: string;
	is?: 'array' | 'string' | 'object';
	spec: FieldSpec;
}

export type FieldSpec =
	/** Always true; left out when off. */
	| { kind: 'true' }
	| { kind: 'boolean' }
	/** A whole number above 0. */
	| { kind: 'count' }
	/** A whole number, 0 or more. */
	| { kind: 'number' }
	/** A whole number, which may be below 0. */
	| { kind: 'integer' }
	| { kind: 'string' }
	/** One of the character's own reminders. */
	| { kind: 'token' }
	| { kind: 'enum'; values: readonly string[] }
	/** Any number of `values`. */
	| { kind: 'enums'; values: readonly string[] }
	/** Any number of the character's own reminders. */
	| { kind: 'tokens' }
	/** A list of text, such as character ids. */
	| { kind: 'strings' }
	/** A list of whole numbers, which may be below 0. */
	| { kind: 'numbers' }
	| { kind: 'object'; fields: readonly ObjectField[] }
	| { kind: 'variants'; variants: readonly Variant[] }
	| { kind: 'list'; of: FieldSpec }
	/** An object keyed by the character's own reminders. */
	| { kind: 'byToken'; of: FieldSpec }
	/** An object keyed by any text, such as a character id. */
	| { kind: 'byKey'; of: FieldSpec }
	/** Written as rules text: a shape too open for fields. */
	| { kind: 'text' };

export type FieldKind = FieldSpec['kind'];

const OPTIONAL = Symbol('optional');
type Optional = { [OPTIONAL]: true; spec: FieldSpec };

export const T: FieldSpec = { kind: 'true' };
export const B: FieldSpec = { kind: 'boolean' };
export const COUNT: FieldSpec = { kind: 'count' };
export const NUM: FieldSpec = { kind: 'number' };
export const INT: FieldSpec = { kind: 'integer' };
export const STR: FieldSpec = { kind: 'string' };
export const TOKEN: FieldSpec = { kind: 'token' };
export const TOKENS: FieldSpec = { kind: 'tokens' };
export const STRS: FieldSpec = { kind: 'strings' };
export const NUMS: FieldSpec = { kind: 'numbers' };
export const TEXT: FieldSpec = { kind: 'text' };
export const oneOf = (values: readonly string[]): FieldSpec => ({ kind: 'enum', values });
export const anyOf = (values: readonly string[]): FieldSpec => ({ kind: 'enums', values });
export const list = (of: FieldSpec): FieldSpec => ({ kind: 'list', of });
export const byToken = (of: FieldSpec): FieldSpec => ({ kind: 'byToken', of });
export const byKey = (of: FieldSpec): FieldSpec => ({ kind: 'byKey', of });
export const variants = (...options: Variant[]): FieldSpec => ({
	kind: 'variants',
	variants: options
});

/** A setting that may be left out. */
export const opt = (spec: FieldSpec): Optional => ({ [OPTIONAL]: true, spec });

/** An object with these settings, in this order. */
export function obj(fields: Record<string, FieldSpec | Optional>): FieldSpec {
	return {
		kind: 'object',
		fields: Object.entries(fields).map(([key, field]): ObjectField =>
			OPTIONAL in field ? { key, spec: field.spec, optional: true } : { key, spec: field }
		)
	};
}

/** An object whose settings may all be left out. */
export function optObj(fields: Record<string, FieldSpec>): FieldSpec {
	return obj(Object.fromEntries(Object.entries(fields).map(([k, s]) => [k, opt(s)])));
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A setting's name as the builder shows it, from its key: words split at capitals, and "token"
 * said as "reminder", the game's word for it ("spentToken" reads "Spent reminder").
 */
export function fieldLabel(key: string): string {
	const words = key
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.toLowerCase()
		.replace(/\btokens\b/g, 'reminders')
		.replace(/\btoken\b/g, 'reminder');
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A choice as the builder shows it: hyphens read as spaces. */
export function optionLabel(value: string): string {
	return value.replace(/-/g, ' ');
}

/** The value a new, empty setting of `spec` starts with. */
export function emptyFor(spec: FieldSpec): unknown {
	switch (spec.kind) {
		case 'true':
			return true;
		case 'object':
		case 'byToken':
		case 'byKey':
			return {};
		case 'list':
		case 'enums':
		case 'tokens':
		case 'strings':
		case 'numbers':
			return [];
		case 'variants':
			return spec.variants[0] ? emptyFor(spec.variants[0].spec) : undefined;
		default:
			return undefined;
	}
}

/** Which of `spec`'s variants `value` is; -1 when none fits. */
export function variantOf(spec: Extract<FieldSpec, { kind: 'variants' }>, value: unknown): number {
	return spec.variants.findIndex((v) => {
		if (v.has) return isRecord(value) && value[v.has] !== undefined;
		if (v.is === 'array') return Array.isArray(value);
		if (v.is === 'string') return typeof value === 'string';
		return isRecord(value);
	});
}

const isWhole = (value: unknown) => typeof value === 'number' && Number.isInteger(value);

/**
 * Where `value` holds something `spec` has no field for (a setting it doesn't list, a choice
 * not among its values, the wrong kind of value), as paths under `path`. Editing such a value
 * with fields would lose that part, so the builder edits it as rules text instead.
 */
export function uncovered(spec: FieldSpec, value: unknown, path = ''): string[] {
	const bad = [path || '(value)'];
	switch (spec.kind) {
		case 'text':
			return [];
		case 'true':
			return value === true ? [] : bad;
		case 'boolean':
			return typeof value === 'boolean' ? [] : bad;
		case 'count':
			return isWhole(value) && (value as number) > 0 ? [] : bad;
		case 'number':
			return isWhole(value) && (value as number) >= 0 ? [] : bad;
		case 'integer':
			return isWhole(value) ? [] : bad;
		case 'string':
		case 'token':
			return typeof value === 'string' ? [] : bad;
		case 'enum':
			return typeof value === 'string' && spec.values.includes(value) ? [] : bad;
		case 'enums':
			return Array.isArray(value) && value.every((v) => spec.values.includes(v)) ? [] : bad;
		case 'tokens':
		case 'strings':
			return Array.isArray(value) && value.every((v) => typeof v === 'string') ? [] : bad;
		case 'numbers':
			return Array.isArray(value) && value.every(isWhole) ? [] : bad;
		case 'list':
			return Array.isArray(value)
				? value.flatMap((item, i) => uncovered(spec.of, item, `${path}[${i}]`))
				: bad;
		case 'byToken':
		case 'byKey':
			return isRecord(value)
				? Object.entries(value).flatMap(([k, v]) => uncovered(spec.of, v, `${path}.${k}`))
				: bad;
		case 'variants': {
			const i = variantOf(spec, value);
			return i < 0 ? bad : uncovered(spec.variants[i]!.spec, value, path);
		}
		case 'object': {
			if (!isRecord(value)) return bad;
			const known = new Set(spec.fields.map((f) => f.key));
			return [
				...Object.keys(value)
					.filter((k) => !known.has(k))
					.map((k) => `${path}.${k}`),
				...spec.fields.flatMap((f) =>
					value[f.key] === undefined
						? f.optional
							? []
							: [`${path}.${f.key}`]
						: uncovered(f.spec, value[f.key], `${path}.${f.key}`)
				)
			];
		}
	}
}

/** A value on one line, for a rule's row: settings by name, lists by commas. */
export function summaryOf(value: unknown): string {
	if (value === true) return 'On';
	if (value === false) return 'Off';
	if (typeof value === 'string') return optionLabel(value);
	if (typeof value === 'number') return String(value);
	if (Array.isArray(value)) return value.map(summaryOf).join(', ');
	if (isRecord(value)) {
		return Object.entries(value)
			.map(([k, v]) => (v === true ? fieldLabel(k) : `${fieldLabel(k)} ${summaryOf(v)}`))
			.join(' · ');
	}
	return '';
}

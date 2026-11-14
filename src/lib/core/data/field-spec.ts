/**
 * How the Character builder edits a rule's value (M62): a small description of the value's
 * shape as written in a rules block, from which one form draws the rule's fields. A part made
 * with `specPart` (`parts/part.ts`) is also read and checked by its spec (`read-spec.ts`).
 */
import type { CharacterId, ReminderLabel } from './types.ts';

/** One setting of an object: its key, how it is edited and whether it may be left out. */
export interface ObjectField {
	key: string;
	spec: FieldSpec;
	optional?: true;
}

/**
 * One shape a value may take, told apart from the others by its `kind` (`tag`), by a key it
 * has (`has`) or by being a list, text or an object (`is`).
 */
export interface Variant {
	label: string;
	/** The value's `kind` (a game mode file's setup sections, `modes/setup-spec.ts`). */
	tag?: string;
	has?: string;
	/** `true`: the value `true`, a rule switched on with nothing more said. */
	is?: 'array' | 'string' | 'number' | 'true' | 'object';
	spec: FieldSpec;
}

export type FieldSpec = Shape & {
	/**
	 * What the value means: for a written guide (the game mode format guide), and the help line
	 * under a setting in the Character builder (M81).
	 */
	readonly about?: string;
	/** The setting's name in plain words, in place of one made from its key (M81). */
	readonly label?: string;
	/** Plain words for a drop-down's choices, by value; others read as `optionLabel` says. */
	readonly names?: Readonly<Record<string, string>>;
	/**
	 * Our own words for the Storyteller, written for official characters only (a step's reason,
	 * a note on where a reminder goes): the Character builder leaves the setting out, so a custom
	 * character is built only from parts that do something, and the app makes do without it (M84).
	 */
	readonly official?: true;
};

type Shape =
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
	/**
	 * An object with these settings. With `pick`, its settings are all optional and only those
	 * set are shown, each added from a drop-down (many settings, few used: a jinx's effects).
	 */
	| { kind: 'object'; fields: readonly ObjectField[]; pick?: true }
	| { kind: 'variants'; variants: readonly Variant[] }
	| { kind: 'list'; of: FieldSpec }
	/** An object keyed by the character's own reminders. */
	| { kind: 'byToken'; of: FieldSpec }
	/** An object keyed by any text. */
	| { kind: 'byKey'; of: FieldSpec }
	/** One character, by id: official or custom (a jinx's partner, M79). */
	| { kind: 'character' }
	/** An object keyed by character id (a character's jinxes, one entry per partner, M79). */
	| { kind: 'byCharacter'; of: FieldSpec }
	/** Written as rules text: a shape too open for fields. */
	| { kind: 'text' };

export type FieldKind = FieldSpec['kind'];

const OPTIONAL = Symbol('optional');
type Optional<S extends FieldSpec = FieldSpec> = { [OPTIONAL]: true; spec: S };

declare const VALUE: unique symbol;
/**
 * A field spec that carries the type of the value it reads (`read-spec.ts`), so a part's value
 * type comes from its spec and is never written a second time. Type-only: nothing at run time.
 */
export type Spec<V> = FieldSpec & { readonly [VALUE]?: V };

/** The value a spec reads. */
export type SpecValue<S> = S extends { readonly [VALUE]?: infer V } ? V : unknown;

type Simplify<T> = { [K in keyof T]: T[K] } & {};
type Required<F> = { [K in keyof F]: F[K] extends Optional ? never : K }[keyof F];
type Optionals<F> = { [K in keyof F]: F[K] extends Optional ? K : never }[keyof F];
type Inner<O> = O extends Optional<infer S> ? S : O;
/** The value of an object with `fields`: its optional settings may be absent. */
type ObjectValue<F> = Simplify<
	{ [K in Required<F>]: SpecValue<F[K]> } & { [K in Optionals<F>]?: SpecValue<Inner<F[K]>> }
>;

export const T: Spec<true> = { kind: 'true' };
export const B: Spec<boolean> = { kind: 'boolean' };
export const COUNT: Spec<number> = { kind: 'count' };
export const NUM: Spec<number> = { kind: 'number' };
export const INT: Spec<number> = { kind: 'integer' };
export const STR: Spec<string> = { kind: 'string' };
export const TOKEN: Spec<ReminderLabel> = { kind: 'token' };
export const TOKENS: Spec<readonly ReminderLabel[]> = { kind: 'tokens' };
export const STRS: Spec<readonly string[]> = { kind: 'strings' };
export const NUMS: Spec<readonly number[]> = { kind: 'numbers' };
export const TEXT: Spec<unknown> = { kind: 'text' };
export const oneOf = <const V extends string>(values: readonly V[]): Spec<V> => ({
	kind: 'enum',
	values
});
export const anyOf = <const V extends string>(values: readonly V[]): Spec<readonly V[]> => ({
	kind: 'enums',
	values
});
export const list = <S extends FieldSpec>(of: S): Spec<readonly SpecValue<S>[]> => ({
	kind: 'list',
	of
});
export const byToken = <S extends FieldSpec>(
	of: S
): Spec<Readonly<Record<ReminderLabel, SpecValue<S>>>> => ({ kind: 'byToken', of });
export const byKey = <S extends FieldSpec>(
	of: S
): Spec<Readonly<Record<string, SpecValue<S>>>> => ({
	kind: 'byKey',
	of
});
export const CHARACTER: Spec<CharacterId> = { kind: 'character' };
export const byCharacter = <S extends FieldSpec>(
	of: S
): Spec<Readonly<Record<CharacterId, SpecValue<S>>>> => ({ kind: 'byCharacter', of });
/** A value of one of several shapes; its value is any of theirs. */
export const variants = <const V extends readonly Variant[]>(
	...options: V
): Spec<SpecValue<V[number]['spec']>> => ({ kind: 'variants', variants: options });

/** `spec`, with what its value means for a written guide. */
export const about = <S extends FieldSpec>(text: string, spec: S): S => ({ ...spec, about: text });

/**
 * `spec`, with its name, help line and choices in plain words for the Character builder (M81,
 * Trevor 2026-11-12: "do it all"). Our own words, never wiki prose.
 */
export const worded = <S extends FieldSpec>(
	words: { label?: string; about?: string; names?: Readonly<Record<string, string>> },
	spec: S
): S => ({ ...spec, ...words });

/** A setting's plain words (M81): its name, help line and choices' names. */
export interface Words {
	label?: string;
	about?: string;
	names?: Readonly<Record<string, string>>;
}

/**
 * `spec` with plain words for the settings under it, by path from the spec itself (M81): `key`
 * for an object's setting, `*` for a list's or keyed object's entries, `<Label>` for one of
 * several shapes (`types`, `reminders.*.target<A chosen player>.choose`). A part's words sit beside its spec in one
 * table; a path that names no setting throws, so a renamed key can't lose its words.
 */
export function wordAt<S extends FieldSpec>(spec: S, words: Readonly<Record<string, Words>>): S {
	const used = new Set<string>();
	const join = (path: string, step: string) => (path ? `${path}.${step}` : step);
	const walk = (at: FieldSpec, path: string): FieldSpec => {
		const own = words[path];
		if (own) used.add(path);
		const next = { ...at, ...own } as FieldSpec;
		switch (next.kind) {
			case 'object':
				return {
					...next,
					fields: next.fields.map((f) => ({ ...f, spec: walk(f.spec, join(path, f.key)) }))
				};
			case 'variants':
				return {
					...next,
					variants: next.variants.map((v) => ({ ...v, spec: walk(v.spec, `${path}<${v.label}>`) }))
				};
			case 'list':
			case 'byToken':
			case 'byKey':
			case 'byCharacter':
				return { ...next, of: walk(next.of, join(path, '*')) };
			default:
				return next;
		}
	};
	const out = walk(spec, '') as S;
	const unknown = Object.keys(words).filter((p) => !used.has(p));
	if (unknown.length) throw new Error(`No setting at ${unknown.join(', ')}`);
	return out;
}

/**
 * `spec` as our own words for official characters, left out of the Character builder (M84,
 * Trevor 2026-11-12: lean against free text). Give it `opt` in an object: a custom character
 * never has it.
 */
export const ownWords = <S extends FieldSpec>(spec: S): S => ({ ...spec, official: true });

/** A list of characters, each picked with the character picker. */
export const CHARACTERS: Spec<readonly CharacterId[]> = { kind: 'list', of: CHARACTER };

/** A setting that may be left out. */
export const opt = <S extends FieldSpec>(spec: S): Optional<S> => ({ [OPTIONAL]: true, spec });

/** An object with these settings, in this order. */
export function obj<const F extends Record<string, FieldSpec | Optional>>(
	fields: F
): Spec<ObjectValue<F>> {
	return {
		kind: 'object',
		fields: Object.entries(fields).map(([key, field]): ObjectField =>
			OPTIONAL in field ? { key, spec: field.spec, optional: true } : { key, spec: field }
		)
	};
}

/** An object of many optional settings, of which only those set are shown. */
export function someOf<const F extends Record<string, FieldSpec>>(
	fields: F
): Spec<Partial<ObjectValue<F>>> {
	return { ...(optObj(fields) as Extract<FieldSpec, { kind: 'object' }>), pick: true };
}

/** An object whose settings may all be left out. */
export function optObj<const F extends Record<string, FieldSpec>>(
	fields: F
): Spec<Partial<ObjectValue<F>>> {
	const all = Object.fromEntries(Object.entries(fields).map(([k, s]) => [k, opt(s)]));
	return obj(all) as FieldSpec;
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

/** Choices that read the same wherever they are offered: the game's own names. */
const CHOICE_NAMES: Readonly<Record<string, string>> = {
	townsfolk: 'Townsfolk',
	outsider: 'Outsider',
	minion: 'Minion',
	demon: 'Demon',
	traveller: 'Traveller',
	fabled: 'Fabled',
	loric: 'Loric',
	good: 'Good',
	evil: 'Evil'
};

/**
 * A choice as the builder shows it: its plain words from `names` (the setting's own) or the
 * game's name for it, else the value with hyphens read as spaces.
 */
export function optionLabel(value: string, names?: Readonly<Record<string, string>>): string {
	return names?.[value] ?? CHOICE_NAMES[value] ?? value.replace(/-/g, ' ');
}

/** The value a new, empty setting of `spec` starts with. */
export function emptyFor(spec: FieldSpec): unknown {
	switch (spec.kind) {
		case 'true':
			return true;
		case 'object':
		case 'byToken':
		case 'byKey':
		case 'byCharacter':
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

/**
 * The value a setting starts with when it is added or its kind is picked: the first choice of
 * a drop-down, 1 for a count, 0 for a number, the first kind of a value with kinds, otherwise
 * empty ({@link emptyFor}).
 */
export function startFor(spec: FieldSpec): unknown {
	switch (spec.kind) {
		case 'enum':
			return spec.values[0];
		case 'count':
			return 1;
		case 'number':
		case 'integer':
			return 0;
		case 'variants':
			return spec.variants[0] ? startVariant(spec.variants[0]) : undefined;
		default:
			return emptyFor(spec);
	}
}

/** A new value of `variant`, carrying the key that tells it apart from the others. */
export function startVariant(variant: Variant): unknown {
	if (!variant.has || variant.spec.kind !== 'object') return startFor(variant.spec);
	const field = variant.spec.fields.find((f) => f.key === variant.has);
	const first = field ? startFor(field.spec) : undefined;
	return { ...(emptyFor(variant.spec) as object), [variant.has]: first ?? '' };
}

/** Which of `spec`'s variants `value` is; -1 when none fits. */
export function variantOf(spec: Extract<FieldSpec, { kind: 'variants' }>, value: unknown): number {
	return spec.variants.findIndex((v) => {
		if (v.tag) return isRecord(value) && value.kind === v.tag;
		if (v.has) return isRecord(value) && value[v.has] !== undefined;
		if (v.is === 'array') return Array.isArray(value);
		if (v.is === 'string') return typeof value === 'string';
		if (v.is === 'number') return typeof value === 'number';
		if (v.is === 'true') return value === true;
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
		case 'character':
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
		case 'byCharacter':
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

/**
 * A value on one line, for a rule's row: settings by name, lists by commas. With its `spec`,
 * settings and choices read in their plain words (M81), and a picked character as a jinx's
 * partner reads (M84).
 */
export function summaryOf(value: unknown, spec?: FieldSpec): string {
	if (spec?.kind === 'variants') {
		const i = variantOf(spec, value);
		return summaryOf(value, i < 0 ? undefined : spec.variants[i]!.spec);
	}
	if (value === true) return 'On';
	if (value === false) return 'Off';
	if (typeof value === 'string')
		return spec?.kind === 'character' ? fieldLabel(value) : optionLabel(value, spec?.names);
	if (typeof value === 'number') return String(value);
	if (Array.isArray(value)) {
		const of = spec?.kind === 'list' ? spec.of : spec?.kind === 'enums' ? spec : undefined;
		return value.map((v) => summaryOf(v, of)).join(', ');
	}
	if (isRecord(value)) {
		const of = spec && 'of' in spec ? spec.of : undefined;
		return Object.entries(value)
			.map(([k, v]) => {
				const field = spec?.kind === 'object' ? spec.fields.find((f) => f.key === k) : undefined;
				const name = field ? settingLabel(field) : fieldLabel(k);
				const sub = field?.spec ?? of;
				return v === true ? name : `${name} ${summaryOf(v, sub)}`;
			})
			.join(' · ');
	}
	return '';
}

/** A setting's name: its plain words, else one made from its key. */
export function settingLabel(field: ObjectField): string {
	return field.spec.label ?? fieldLabel(field.key);
}

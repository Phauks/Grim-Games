import type { en } from '#lib/i18n/messages/en.ts';

/**
 * Message catalogs and formatting. Pure TypeScript (no Svelte, no DOM), so the rules core can
 * describe text as a `Message` (a key plus its values) and leave the wording to the UI.
 */

/** Plural forms keyed by `Intl.PluralRules` category; `other` is always required. */
export type PluralForms = { readonly other: string } & {
	readonly [C in Intl.LDMLPluralRule]?: string;
};
export type MessageValue = string | PluralForms;
export type Catalog = Readonly<Record<string, MessageValue>>;

export type SourceCatalog = typeof en;
export type MessageKey = keyof SourceCatalog;

/** A translation of the source catalog; keys it leaves out fall back to English. */
export type Translation = { readonly [K in MessageKey]?: MessageValue };

type Placeholders<S> = S extends `${string}{${infer Name}}${infer Rest}`
	? Name | Placeholders<Rest>
	: never;

type ValueOf<V> = V extends string ? V : V extends PluralForms ? V[keyof V] : never;

/** The values a message needs: one per `{placeholder}`, and a numeric `count` for plurals. */
export type MessageParams<K extends MessageKey> = SourceCatalog[K] extends string
	? { [P in Placeholders<SourceCatalog[K]>]: string | number }
	: { [P in Exclude<Placeholders<ValueOf<SourceCatalog[K]>>, 'count'>]: string | number } & {
			count: number;
		};

/** The trailing argument of `t()`: absent for messages without placeholders. */
export type ParamsArg<K extends MessageKey> = [keyof MessageParams<K>] extends [never]
	? []
	: [params: MessageParams<K>];

/** Keys of messages without placeholders, for tables of labels that `t(key)` reads. */
export type PlainMessageKey = {
	[K in MessageKey]: ParamsArg<K> extends [] ? K : never;
}[MessageKey];

/** Text described rather than written: what core returns where it used to return English. */
export type Message = {
	[K in MessageKey]: [keyof MessageParams<K>] extends [never]
		? { key: K }
		: { key: K; params: MessageParams<K> };
}[MessageKey];

const PLACEHOLDER = /\{(\w+)\}/g;

/** The `{name}` placeholders in a message, across all its plural forms, sorted. */
export function placeholdersOf(value: MessageValue): string[] {
	const texts = typeof value === 'string' ? [value] : Object.values(value);
	const names = new Set<string>();
	for (const text of texts) for (const match of text.matchAll(PLACEHOLDER)) names.add(match[1]);
	return [...names].sort();
}

/**
 * One of each formatter per locale: making an `Intl` formatter costs far more than using one,
 * and `t()` runs for every label each time a screen redraws (the Test room lagged on Trevor's
 * Pixel, 2026-10-31, with this the busiest code on the page).
 */
const pluralRules = new Map<string, Intl.PluralRules>();
const numberFormats = new Map<string, Intl.NumberFormat>();

function cached<T>(cache: Map<string, T>, locale: string, make: () => T): T {
	let value = cache.get(locale);
	if (!value) cache.set(locale, (value = make()));
	return value;
}

/** Fills a message for a locale. Numbers are formatted for the locale; unknown names stay. */
export function formatMessage(
	value: MessageValue,
	params: Readonly<Record<string, string | number>>,
	locale: string
): string {
	let text: string;
	if (typeof value === 'string') {
		text = value;
	} else {
		const count = Number(params.count);
		const category = cached(pluralRules, locale, () => new Intl.PluralRules(locale)).select(count);
		text = value[category] ?? value.other;
	}
	// Most messages have nothing to fill in.
	if (!text.includes('{')) return text;
	return text.replace(PLACEHOLDER, (whole, name: string) => {
		const param = params[name];
		if (param === undefined) return whole;
		if (typeof param !== 'number') return param;
		return cached(numberFormats, locale, () => new Intl.NumberFormat(locale)).format(param);
	});
}

export type Translate = <K extends MessageKey>(key: K, ...args: ParamsArg<K>) => string;

/** A `t()` for one locale, falling back to the source catalog key by key. */
export function createTranslator(
	locale: string,
	translation: Translation,
	source: SourceCatalog
): Translate {
	return (key, ...args) => {
		const value = translation[key] ?? source[key];
		// A key from outside the type system (old saved data, a stale build): show the key.
		if (value === undefined) return key;
		return formatMessage(value, (args[0] ?? {}) as Record<string, string | number>, locale);
	};
}

/** Problems with a translation against the source catalog, as readable lines. */
export function checkTranslation(
	locale: string,
	translation: Readonly<Record<string, MessageValue>>,
	source: Catalog,
	{ requireComplete }: { requireComplete: boolean }
): string[] {
	const problems: string[] = [];
	const categories = new Set<string>(
		new Intl.PluralRules(locale).resolvedOptions().pluralCategories
	);
	for (const key of Object.keys(source)) {
		if (!(key in translation)) {
			if (requireComplete) problems.push(`${locale}: missing ${key}`);
			continue;
		}
		const expected = source[key];
		const actual = translation[key];
		if (typeof expected !== typeof actual) {
			problems.push(
				`${locale}: ${key} must be ${typeof expected === 'string' ? 'a string' : 'plural forms'}`
			);
			continue;
		}
		const want = placeholdersOf(expected).filter(
			(name) => name !== 'count' || typeof expected === 'string'
		);
		const have = placeholdersOf(actual).filter(
			(name) => name !== 'count' || typeof actual === 'string'
		);
		if (want.join() !== have.join()) {
			problems.push(
				`${locale}: ${key} has {${have.join('}, {')}} but English has {${want.join('}, {')}}`
			);
		}
		if (typeof actual !== 'string') {
			for (const category of Object.keys(actual)) {
				if (!categories.has(category))
					problems.push(`${locale}: ${key} has a "${category}" form ${locale} never uses`);
			}
			for (const category of categories) {
				if (!(category in actual))
					problems.push(`${locale}: ${key} is missing its "${category}" form`);
			}
		}
	}
	for (const key of Object.keys(translation)) {
		if (!(key in source)) problems.push(`${locale}: ${key} is not an English key`);
	}
	return problems;
}

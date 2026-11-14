import type { Catalog, MessageValue } from './catalog.ts';

const PLACEHOLDER = /\{(\w+)\}/g;

/** The `{name}` placeholders in a message, across all its plural forms, sorted. */
export function placeholdersOf(value: MessageValue): string[] {
	const texts = typeof value === 'string' ? [value] : Object.values(value);
	const names = new Set<string>();
	for (const text of texts) for (const match of text.matchAll(PLACEHOLDER)) names.add(match[1]);
	return [...names].sort();
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

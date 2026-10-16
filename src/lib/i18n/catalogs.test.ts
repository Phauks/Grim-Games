import { describe, expect, it } from 'vitest';
import { checkTranslation, type MessageValue } from '#lib/i18n/catalog.ts';
import { TRANSLATIONS } from '#lib/i18n/catalogs.ts';
import { LOCALES, matchLocale } from '#lib/i18n/locales.ts';
import { en } from '#lib/i18n/messages/en.ts';

describe('catalogs', () => {
	it('has a loader for every locale except English, and no others', () => {
		const ids = LOCALES.map((locale) => locale.id as string).filter((id) => id !== 'en');
		expect(Object.keys(TRANSLATIONS).sort()).toEqual(ids.sort());
	});

	it('keeps every translation in step with the English keys and placeholders', async () => {
		const problems: string[] = [];
		for (const [id, load] of Object.entries(TRANSLATIONS) as [string, () => Promise<object>][]) {
			const released = LOCALES.find((locale) => locale.id === id)?.released ?? false;
			const translation = (await load()) as Record<string, MessageValue>;
			problems.push(...checkTranslation(id, translation, en, { requireComplete: released }));
		}
		expect(problems).toEqual([]);
	});

	it('uses <area>.<name> keys', () => {
		for (const key of Object.keys(en)) expect(key).toMatch(/^[a-z][a-z-]*(\.[a-zA-Z][\w-]*)+$/);
	});

	it('matches the device language to a released locale, else English', () => {
		expect(matchLocale(['en-GB'])).toBe('en');
		expect(matchLocale(['xx', 'en'])).toBe('en');
		expect(matchLocale([])).toBe('en');
	});
});

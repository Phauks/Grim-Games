/**
 * The interface languages the app knows about. English is the source language: every other
 * catalog translates its keys (messages/en.ts), and a missing translation falls back to it.
 *
 * Game text (character names, abilities, night text, jinxes) comes from TPI's data and the
 * BotC wiki, which are English only, so it is not part of these catalogs.
 */
export interface LocaleInfo {
	/** BCP 47 tag, also used for `Intl` formatting and `<html lang>`. */
	id: string;
	/** The language's name in itself, as a language picker shows it. */
	name: string;
	dir: 'ltr' | 'rtl';
	/**
	 * Offered to users. A locale being translated stays unreleased until its catalog is
	 * complete; the catalog check enforces completeness for released locales only.
	 */
	released: boolean;
}

export const LOCALES = [
	{ id: 'en', name: 'English', dir: 'ltr', released: true }
] as const satisfies readonly LocaleInfo[];

export type LocaleId = (typeof LOCALES)[number]['id'];

export const SOURCE_LOCALE: LocaleId = 'en';

export function isLocaleId(value: unknown): value is LocaleId {
	return LOCALES.some((locale) => locale.id === value);
}

export function localeInfo(id: LocaleId): LocaleInfo {
	return LOCALES.find((locale) => locale.id === id) ?? LOCALES[0];
}

/**
 * Picks the first released locale matching the device's preferred languages, comparing the
 * full tag first and then the language alone ("pt-BR" matches "pt"). Falls back to English.
 */
export function matchLocale(preferred: readonly string[]): LocaleId {
	const released: readonly LocaleInfo[] = LOCALES.filter((locale) => locale.released);
	for (const tag of preferred) {
		const lower = tag.toLowerCase();
		const exact = released.find((locale) => locale.id.toLowerCase() === lower);
		if (exact) return exact.id as LocaleId;
		const language = lower.split('-')[0];
		const partial = released.find((locale) => locale.id.toLowerCase().split('-')[0] === language);
		if (partial) return partial.id as LocaleId;
	}
	return SOURCE_LOCALE;
}

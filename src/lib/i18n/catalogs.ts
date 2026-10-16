import type { Translation } from '#lib/i18n/catalog.ts';
import type { LocaleId } from '#lib/i18n/locales.ts';

/**
 * Loaders for the non-English catalogs, one dynamic import each so a language is only
 * downloaded when chosen (the service worker precaches every build chunk, so all of them
 * still work offline). English is bundled with the app and needs no loader.
 *
 * Add a locale here, to LOCALES (locales.ts) and as messages/<id>.ts together.
 */
export const TRANSLATIONS: Readonly<Record<Exclude<LocaleId, 'en'>, () => Promise<Translation>>> =
	{};

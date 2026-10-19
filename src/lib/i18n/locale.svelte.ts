import { readStoredText, writeStoredText } from '#lib/ui/stored.ts';
import {
	createTranslator,
	type Message,
	type MessageKey,
	type ParamsArg,
	type Translation
} from '#lib/i18n/catalog.ts';
import { TRANSLATIONS } from '#lib/i18n/catalogs.ts';
import {
	isLocaleId,
	localeInfo,
	matchLocale,
	SOURCE_LOCALE,
	type LocaleId
} from '#lib/i18n/locales.ts';
import { en } from '#lib/i18n/messages/en.ts';

const STORAGE_KEY = 'grim-games:locale:v1';

/** What the user picked: a locale, or "device" to follow the device's languages. */
export type LocaleChoice = LocaleId | 'device';

function readChoice(): LocaleChoice {
	const raw = readStoredText(STORAGE_KEY);
	return isLocaleId(raw) ? raw : 'device';
}

function writeChoice(choice: LocaleChoice): void {
	// Storage blocked: the choice still applies for this visit.
	writeStoredText(STORAGE_KEY, choice === 'device' ? undefined : choice);
}

function deviceLocale(): LocaleId {
	return matchLocale(globalThis.navigator?.languages ?? []);
}

async function loadTranslation(id: LocaleId): Promise<Translation> {
	if (id === SOURCE_LOCALE) return {};
	const loaders: Readonly<Record<string, (() => Promise<Translation>) | undefined>> = TRANSLATIONS;
	return (await loaders[id]?.()) ?? {};
}

/**
 * The interface language for this device. Per device, like the look-and-feel preferences,
 * and never synced to rooms: each phone in a live game reads in its own language.
 */
class LocaleStore {
	choice = $state<LocaleChoice>(readChoice());
	/** The locale whose catalog is loaded; stays on the old one while a new one downloads. */
	current = $state<LocaleId>(SOURCE_LOCALE);
	#translation = $state.raw<Translation>({});
	translate = $derived(createTranslator(this.current, this.#translation, en));

	/** Loads the chosen locale's catalog; call once at start-up. */
	async init(): Promise<void> {
		await this.#apply(this.choice === 'device' ? deviceLocale() : this.choice);
	}

	async set(choice: LocaleChoice): Promise<void> {
		this.choice = choice;
		writeChoice(choice);
		await this.#apply(choice === 'device' ? deviceLocale() : choice);
	}

	async #apply(id: LocaleId): Promise<void> {
		const translation = await loadTranslation(id);
		this.#translation = translation;
		this.current = id;
		const root = globalThis.document?.documentElement;
		if (root) {
			root.lang = id;
			root.dir = localeInfo(id).dir;
		}
	}
}

export const locale = new LocaleStore();

/** The interface text for a key in the current language; reactive in templates. */
export function t<K extends MessageKey>(key: K, ...args: ParamsArg<K>): string {
	return locale.translate(key, ...args);
}

/** Words for a `Message` returned by core. */
export function say(message: Message): string {
	const params = 'params' in message ? message.params : {};
	return (locale.translate as (key: MessageKey, params: object) => string)(message.key, params);
}

/** `Intl` formatters for the current language, for numbers, lists, dates and sorting. */
export const intl = {
	number: (value: number, options?: Intl.NumberFormatOptions) =>
		new Intl.NumberFormat(locale.current, options).format(value),
	list: (items: readonly string[], options?: Intl.ListFormatOptions) =>
		new Intl.ListFormat(locale.current, options).format(items),
	date: (value: Date | number, options?: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat(locale.current, options).format(value),
	relative: (value: number, unit: Intl.RelativeTimeFormatUnit) =>
		new Intl.RelativeTimeFormat(locale.current, { numeric: 'auto' }).format(value, unit),
	compare: (a: string, b: string) => a.localeCompare(b, locale.current),
	/** A country or region's name from its ISO code ("US" → "United States"); the code if unknown. */
	region: (code: string) => {
		try {
			return new Intl.DisplayNames(locale.current, { type: 'region' }).of(code) ?? code;
		} catch {
			return code;
		}
	}
};

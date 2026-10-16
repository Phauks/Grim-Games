import { reportError } from '#lib/features/errors/report.svelte.ts';
import {
	MAX_CUSTOM_TEXT,
	parseStoredInfoTokens,
	type CustomInfoToken,
	type CustomOptions,
	type StoredInfoTokens
} from './custom-tokens.ts';

const STORAGE_KEY = 'grim-games:info-tokens';

function read(): StoredInfoTokens {
	try {
		const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
		return parseStoredInfoTokens(raw ? JSON.parse(raw) : null);
	} catch (error) {
		// Blocked storage or corrupt JSON: start empty. Logged only; the page still works.
		reportError(error, { area: 'info-tokens', notify: false });
		return parseStoredInfoTokens(null);
	}
}

/** Custom info tokens on this device, saved in localStorage on every change. */
class CustomInfoTokens {
	#stored = $state<StoredInfoTokens>(read());

	get list(): readonly CustomInfoToken[] {
		return this.#stored.custom;
	}

	#save(custom: CustomInfoToken[]): void {
		this.#stored = { version: 2, custom };
		try {
			globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.#stored));
		} catch (error) {
			// Storage full or blocked: the card works until the page reloads, so say it wasn't saved.
			reportError(error, { area: 'info-tokens' });
		}
	}

	/**
	 * Adds a card, or changes an existing one. `withCharacters`: the Storyteller picks
	 * characters to show with it; `characterIds`: the characters it belongs to; `blank`: a
	 * word to fill in when shown. Blank text does nothing.
	 */
	save(text: string, id?: string, options: CustomOptions = {}): void {
		const { withCharacters = false, characterIds = [], blank = false } = options;
		const clean = text.trim().slice(0, MAX_CUSTOM_TEXT);
		if (!clean) return;
		const custom = [...this.#stored.custom];
		const at = id === undefined ? -1 : custom.findIndex((t) => t.id === id);
		const token: CustomInfoToken = {
			id: at >= 0 ? custom[at].id : `custom-${crypto.randomUUID()}`,
			text: clean,
			source: 'custom',
			shows: withCharacters ? 'characters' : 'none',
			...(characterIds.length ? { characterIds: [...characterIds] } : {}),
			...(blank ? { blank: true } : {})
		};
		if (at >= 0) custom[at] = token;
		else custom.push(token);
		this.#save(custom);
	}

	remove(id: string): void {
		this.#save(this.#stored.custom.filter((t) => t.id !== id));
	}
}

export const customInfoTokens = new CustomInfoTokens();

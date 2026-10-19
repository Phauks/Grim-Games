import type { CharacterId } from '#lib/core/data/index.ts';
import type { InfoTokenAsks } from '#lib/core/data/info-tokens.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import {
	MAX_CUSTOM_TEXT,
	parseAsks,
	parseStoredInfoTokens,
	type CustomInfoToken,
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
		this.#stored = { version: 3, custom };
		try {
			globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.#stored));
		} catch (error) {
			// Storage full or blocked: the card works until the page reloads, so say it wasn't saved.
			reportError(error, { area: 'info-tokens' });
		}
	}

	/**
	 * Adds a card, or changes an existing one: `characterIds` are the characters it belongs
	 * to, `asks` what it asks for when shown. Blank text does nothing.
	 */
	save(
		text: string,
		id?: string,
		options: {
			characterIds?: readonly CharacterId[];
			asks?: InfoTokenAsks;
			answerOnly?: boolean;
		} = {}
	): void {
		const { characterIds = [] } = options;
		const clean = text.trim().slice(0, MAX_CUSTOM_TEXT);
		if (!clean) return;
		// The same checks as reading it back, so a save never holds what a load would drop.
		const asks = parseAsks(options.asks);
		const custom = [...this.#stored.custom];
		const at = id === undefined ? -1 : custom.findIndex((t) => t.id === id);
		const token: CustomInfoToken = {
			id: at >= 0 ? custom[at].id : `custom-${crypto.randomUUID()}`,
			text: clean,
			source: 'custom',
			...(asks ? { asks } : {}),
			...(asks?.value && options.answerOnly ? { answerOnly: true as const } : {}),
			...(characterIds.length ? { characterIds: [...characterIds] } : {})
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

import type { CharacterId } from '#lib/core/data/index.ts';
import type { InfoToken } from '#lib/core/data/info-tokens.ts';
import { boldToRed } from './bold.ts';

/**
 * A Storyteller's own card. Beyond the text (Trevor, 2026-10-16):
 * - `characterIds`: it belongs to these characters, so it sits under Character Specific and
 *   a game offers it only while one of them is in play;
 * - `blank`: the Storyteller fills in a word or number each time it is shown, like the
 *   Mezepheles's secret word.
 */
export interface CustomInfoToken extends InfoToken {
	source: 'custom';
	characterIds?: CharacterId[];
	blank?: boolean;
}

/** What the Storyteller sets on a custom card besides its text. */
export interface CustomOptions {
	withCharacters?: boolean;
	characterIds?: readonly CharacterId[];
	blank?: boolean;
}

/**
 * The Storyteller's own info tokens, kept on this device. Versioned, because a newer
 * build can open what an older one saved (CLAUDE.md); bump `version` with a migration.
 */
export interface StoredInfoTokens {
	/** 2: `**bold**` means heavier type and colour has its own `[red]` tags (2026-10-16). */
	version: 2;
	custom: CustomInfoToken[];
}

export const MAX_CUSTOM_TEXT = 200;

export function emptyStore(): StoredInfoTokens {
	return { version: 2, custom: [] };
}

/** Reads what was stored, dropping anything malformed instead of failing. */
export function parseStoredInfoTokens(raw: unknown): StoredInfoTokens {
	if (typeof raw !== 'object' || raw === null) return emptyStore();
	const value = raw as { version?: unknown; custom?: unknown };
	if ((value.version !== 1 && value.version !== 2) || !Array.isArray(value.custom))
		return emptyStore();
	// Version 1 drew bold as red: keep the red, as a colour (Trevor, 2026-10-16).
	const migrate = value.version === 1 ? boldToRed : (text: string) => text;
	const custom: CustomInfoToken[] = [];
	for (const item of value.custom) {
		if (typeof item !== 'object' || item === null) continue;
		const { id, text, shows, characterIds, blank } = item as {
			id?: unknown;
			text?: unknown;
			shows?: unknown;
			characterIds?: unknown;
			blank?: unknown;
		};
		if (typeof id !== 'string' || typeof text !== 'string' || !text.trim()) continue;
		if (custom.some((t) => t.id === id)) continue;
		custom.push({
			id,
			text: migrate(text).slice(0, MAX_CUSTOM_TEXT),
			source: 'custom',
			// A custom card may ask for characters, e.g. a madness card (Trevor, 2026-10-16).
			shows: shows === 'characters' ? 'characters' : 'none',
			// Both added later in version 1 as optional fields, so older saves read as before.
			...(Array.isArray(characterIds) && characterIds.some((c) => typeof c === 'string')
				? { characterIds: [...new Set(characterIds.filter((c) => typeof c === 'string'))] }
				: {}),
			...(blank === true ? { blank: true } : {})
		});
	}
	return { version: 2, custom };
}

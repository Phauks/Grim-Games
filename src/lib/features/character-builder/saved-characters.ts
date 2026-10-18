/**
 * Characters made in the Character builder, kept on this device. Versioned, because a newer
 * build can read what an older one saved (CLAUDE.md). Each is TPI's script character object
 * as the Script builder puts it on a script.
 */
import type { HomebrewEntry } from '#lib/core/rules/script-builder.ts';
import {
	characterEntry,
	fieldsFromEntry,
	type CharacterFields
} from '#lib/core/rules/character-builder.ts';

export const SAVED_CHARACTERS_VERSION = 1;

export interface SavedCharacter {
	/** This device's id for the saved character; the character's own id is in `entry`. */
	savedId: string;
	entry: HomebrewEntry;
	/** Epoch ms. */
	updatedAt: number;
}

export interface SavedCharacters {
	version: typeof SAVED_CHARACTERS_VERSION;
	characters: SavedCharacter[];
}

export function emptySavedCharacters(): SavedCharacters {
	return { version: SAVED_CHARACTERS_VERSION, characters: [] };
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Stored characters, or none when missing, damaged or from a newer build. */
export function parseSavedCharacters(raw: unknown): SavedCharacters {
	if (!isObject(raw) || raw.version !== SAVED_CHARACTERS_VERSION) return emptySavedCharacters();
	const list = Array.isArray(raw.characters) ? raw.characters : [];
	const seen = new Set<string>();
	const characters = list.flatMap((c): SavedCharacter[] => {
		if (!isObject(c) || typeof c.savedId !== 'string' || !isObject(c.entry)) return [];
		if (seen.has(c.savedId)) return [];
		seen.add(c.savedId);
		// Read back through the form, so only the fields the builder writes are kept.
		const entry = characterEntry(fieldsFromEntry(c.entry));
		return [{ savedId: c.savedId, entry, updatedAt: Number(c.updatedAt) || 0 }];
	});
	return { version: SAVED_CHARACTERS_VERSION, characters };
}

export function fieldsOf(saved: SavedCharacter): CharacterFields {
	return fieldsFromEntry(saved.entry);
}

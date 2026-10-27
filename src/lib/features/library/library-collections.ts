/**
 * Character collections (Trevor, 2026-10-18): a named set of characters kept in the Library,
 * official ones by their id and Character builder ones as `saved:<savedId>`. Versioned, because
 * a newer build can open what an older one stored (CLAUDE.md).
 */
import { timestampName } from '#lib/core/timestamp-name.ts';
import { cleanName } from './library-labels.ts';

export const COLLECTIONS_VERSION = 1;

export interface CharacterCollection {
	id: string;
	name: string;
	/** Official character ids, or `saved:<savedId>` for a character from the Character builder. */
	characters: string[];
	/** Epoch ms. */
	updatedAt: number;
}

export interface Collections {
	version: typeof COLLECTIONS_VERSION;
	collections: CharacterCollection[];
}

/** A Character builder character, as a collection holds it. */
export const savedRef = (savedId: string) => `saved:${savedId}`;
export const savedIdOf = (ref: string) => (ref.startsWith('saved:') ? ref.slice(6) : undefined);

export function emptyCollections(): Collections {
	return { version: COLLECTIONS_VERSION, collections: [] };
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads what was stored. Unreadable or missing data starts empty; data from a newer build is
 * undefined, so the caller leaves it alone rather than overwriting it.
 */
export function parseCollections(raw: unknown): Collections | undefined {
	if (!isObject(raw)) return emptyCollections();
	if (typeof raw.version === 'number' && raw.version > COLLECTIONS_VERSION) return undefined;
	if (raw.version !== COLLECTIONS_VERSION || !Array.isArray(raw.collections)) {
		return emptyCollections();
	}
	const seen = new Set<string>();
	const collections = raw.collections.flatMap((c): CharacterCollection[] => {
		if (!isObject(c) || typeof c.id !== 'string' || typeof c.name !== 'string') return [];
		if (seen.has(c.id)) return [];
		seen.add(c.id);
		const characters = Array.isArray(c.characters)
			? [...new Set(c.characters.filter((r): r is string => typeof r === 'string' && r !== ''))]
			: [];
		return [
			{
				id: c.id,
				name: cleanName(c.name),
				characters,
				updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : 0
			}
		];
	});
	return { version: COLLECTIONS_VERSION, collections };
}

/** Adds an empty collection; a blank name changes nothing. */
export function addCollection(
	state: Collections,
	id: string,
	name: string,
	now: number
): Collections {
	// Never without a name (Trevor, 2026-10-18): a blank one becomes a timestamp.
	const clean = cleanName(name) || timestampName(new Date(now));
	return {
		...state,
		collections: [...state.collections, { id, name: clean, characters: [], updatedAt: now }]
	};
}

function change(
	state: Collections,
	id: string,
	edit: (c: CharacterCollection) => CharacterCollection
): Collections {
	if (!state.collections.some((c) => c.id === id)) return state;
	return { ...state, collections: state.collections.map((c) => (c.id === id ? edit(c) : c)) };
}

export function renameCollection(
	state: Collections,
	id: string,
	name: string,
	now: number
): Collections {
	const clean = cleanName(name) || timestampName(new Date(now));
	return change(state, id, (c) => ({ ...c, name: clean, updatedAt: now }));
}

/** Puts the character in the collection, or takes it out. */
export function toggleCharacter(
	state: Collections,
	id: string,
	ref: string,
	now: number
): Collections {
	return change(state, id, (c) => ({
		...c,
		characters: c.characters.includes(ref)
			? c.characters.filter((r) => r !== ref)
			: [...c.characters, ref],
		updatedAt: now
	}));
}

export function deleteCollection(state: Collections, id: string): Collections {
	return { ...state, collections: state.collections.filter((c) => c.id !== id) };
}

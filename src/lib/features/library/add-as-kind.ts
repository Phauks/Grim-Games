/**
 * Adds loaded JSON to the Library as characters or a character collection rather than a
 * script (backlog L23: the add confirmation's kind drop-down). Change kind
 * (`ChangeKind.svelte`) saves characters the same way.
 */
import type { Character, LoadedScript } from '#lib/core/data/index.ts';
import { fieldsFromEntry } from '#lib/core/rules/index.ts';
import type { HomebrewEntry } from '#lib/core/rules/script-builder.ts';
import { savedCharacters } from '#lib/features/character-builder/stores.svelte.ts';
import { savedRef } from './library-collections.ts';
import { characterCollections } from './library-collections.svelte.ts';
import { characterKey, collectionKey } from './library-items.ts';

/** A character as a script entry: an official one copied in full, so it can be edited. */
export function entryOf(character: Character): HomebrewEntry {
	const { type, special, ...rest } = character;
	return {
		...rest,
		team: type,
		...(special.length > 0 ? { special } : {})
	} as unknown as HomebrewEntry;
}

/** The script's own characters, each saved as a Character builder character. */
const ownCharacters = (script: LoadedScript) =>
	script.characters.filter((c) => script.homebrew.includes(c.id));

/** Saves each of the script's own characters; returns their Library keys, in order. */
export function addAsCharacters(script: LoadedScript): string[] {
	return ownCharacters(script).map((c) =>
		characterKey(savedCharacters.save(fieldsFromEntry(entryOf(c))))
	);
}

/**
 * Saves the script's characters as a collection named `name`: its own as Character builder
 * characters, official ones by id. Returns the collection's Library key.
 */
export function addAsCollection(script: LoadedScript, name: string): string | undefined {
	const id = characterCollections.add(name);
	if (!id) return undefined;
	for (const c of script.characters) {
		const ref = script.homebrew.includes(c.id)
			? savedRef(savedCharacters.save(fieldsFromEntry(entryOf(c))))
			: (c.id as string);
		characterCollections.toggle(id, ref);
	}
	return collectionKey(id);
}

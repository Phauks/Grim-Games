import { getContext, setContext } from 'svelte';
import type { CharacterId } from '#lib/core/data/index.ts';
import type { CharacterLookup } from '#lib/core/model/index.ts';

const KEY = Symbol('characters');

/**
 * Gives every CharacterBadge below this component the game's own characters, so a script's
 * homebrew characters show their name and icon, not their id (Trevor, 2026-10-17). Call it
 * from a component's script; `lookup` is read each time, so it can follow a changing game.
 */
export function provideCharacters(lookup: () => CharacterLookup | undefined): void {
	setContext(KEY, lookup);
}

/** The characters given by the nearest `provideCharacters`, if any. */
export function contextCharacters(): (() => CharacterLookup | undefined) | undefined {
	return getContext(KEY);
}

const SHOWN = Symbol('shown character');

/**
 * Marks everything below as being inside this character's own details (CharacterDialog): a
 * badge for the same character there is drawn but not tappable, since tapping it opened a
 * second copy of the dialog over the first (Trevor, 2026-10-19).
 */
export function provideShownCharacter(id: () => CharacterId): void {
	setContext(SHOWN, id);
}

/** The character whose details are open around this component, if any. */
export function shownCharacter(): (() => CharacterId) | undefined {
	return getContext(SHOWN);
}

import { getContext, setContext } from 'svelte';
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

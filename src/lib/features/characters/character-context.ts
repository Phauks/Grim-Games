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

/** The character whose details (CharacterDialog) are open around a component. */
export interface ShownCharacter {
	id: () => CharacterId;
	/** Draws the eye back to those details, instead of opening a second copy of them. */
	focus: () => void;
}

/**
 * Marks everything below as being inside this character's own details (CharacterDialog): a
 * badge for the same character there does not open a second copy of the dialog over the
 * first (Trevor, 2026-10-19) but calls `focus`, which brings the details back into view
 * (Trevor, 2026-10-20).
 */
export function provideShownCharacter(shown: ShownCharacter): void {
	setContext(SHOWN, shown);
}

/** The character whose details are open around this component, if any. */
export function shownCharacter(): ShownCharacter | undefined {
	return getContext(SHOWN);
}

/** Ends `provideShownCharacter` below this component (a dialog of other characters opened from it). */
export function clearShownCharacter(): void {
	setContext(SHOWN, undefined);
}

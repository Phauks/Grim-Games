import { getContext, setContext, type Snippet } from 'svelte';
import type { CharacterId } from '#lib/core/data/index.ts';

const KEY = Symbol('day-tokens');

/**
 * A character's reminder tokens under its day row, to place as a night step's (Trevor,
 * 2026-11-16): the board gives them to the Day tab beside it; the day spike has none.
 */
export function provideDayTokens(tokens: Snippet<[CharacterId]>): void {
	setContext(KEY, tokens);
}

/** The day row's tokens, if the board gave them. */
export function dayTokens(): Snippet<[CharacterId]> | undefined {
	return getContext<Snippet<[CharacterId]> | undefined>(KEY);
}

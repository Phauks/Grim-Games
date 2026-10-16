import type { Alignment, Character } from '#lib/core/data/index.ts';

export interface ShownCharacter {
	character: Character;
	/** Which icon to show; defaults from the character type. */
	alignment?: Alignment;
}

/** One info card in a chain shown to a player (Trevor, 2026-10-16). */
export interface ShownInfoCard {
	/** The card's text; `**bold**` is supported. */
	title?: string;
	characters?: readonly ShownCharacter[];
	/** What the Storyteller filled in, shown as typed, e.g. the Mezepheles's secret word. */
	detail?: string;
}

import type { Alignment, Character, CharacterId, Jinx } from '#lib/core/data/index.ts';

export interface ShownCharacter {
	character: Character;
	/** Which icon to show; defaults from the character type. */
	alignment?: Alignment;
	/** The character's jinxes, under its ability when it is shown alone (Trevor, 2026-11-04). */
	jinxes?: readonly Jinx[];
	/** The script's characters, for a homebrew partner's name and icon in those jinxes. */
	jinxCharacters?: ReadonlyMap<CharacterId, Character>;
}

/** One info card in a chain shown to a player (Trevor, 2026-10-16). */
export interface ShownInfoCard {
	/** The card's text; `**bold**` is supported. */
	title?: string;
	characters?: readonly ShownCharacter[];
	/** What the Storyteller filled in, shown as typed, e.g. the Mezepheles's secret word. */
	detail?: string;
}

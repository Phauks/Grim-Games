import type { CharacterId } from '#lib/core/data/index.ts';

/**
 * Info cards that belong to one character and only load when it is on the script (Trevor,
 * 2026-10-16), e.g. the Mezepheles's secret word. The Reference page reads this list for its
 * card column.
 *
 * TPI's night sheet says "Show the secret word" for the Mezepheles and "secret phrase" for
 * the Yaggababble (botc-release resources/data/roles.json); the card text is Trevor's
 * ("Your Secret Word is", 2026-10-16). Other cards in our own wording (Amnesiac, Wizard,
 * Djinn, announcements) wait for his approval:
 * /mnt/project-files/pocket-grimoire-rewrite/character-cards.md.
 */
export interface CharacterCard {
	/** Unique across all info tokens. */
	id: string;
	characterId: CharacterId;
	/** i18n key of the card's text. */
	titleKey: 'info-tokens.card.secretWord' | 'info-tokens.card.secretPhrase';
	/** What the Storyteller fills in before showing it. */
	fills: 'word' | 'phrase';
	/** Whose wording the card uses; `own` cards stay behind the own-wording setting. */
	source: 'own' | 'own';
}

export const CHARACTER_CARDS: readonly CharacterCard[] = [
	{
		id: 'character:mezepheles:secret-word',
		characterId: 'mezepheles',
		titleKey: 'info-tokens.card.secretWord',
		fills: 'word',
		source: 'own'
	},
	{
		id: 'character:yaggababble:secret-phrase',
		characterId: 'yaggababble',
		titleKey: 'info-tokens.card.secretPhrase',
		fills: 'phrase',
		source: 'own'
	}
];

/** The cards for these characters, in the order given. */
export function characterCardsFor(characterIds: readonly CharacterId[]): CharacterCard[] {
	return characterIds.flatMap((id) => CHARACTER_CARDS.filter((card) => card.characterId === id));
}

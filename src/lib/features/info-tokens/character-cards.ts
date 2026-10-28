import type { InfoCard } from '#lib/core/data/choice-rules.ts';
import type { Character, CharacterId } from '#lib/core/data/index.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/index.ts';

/**
 * Info cards that belong to one character and only load when it is on the script (Trevor,
 * 2026-10-16), e.g. the Mezepheles's secret word, from the character's `infoCard` rule.
 * The Reference page reads them for its card column.
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

const CARDS: Readonly<Record<InfoCard, Pick<CharacterCard, 'titleKey' | 'fills'>>> = {
	'secret-word': { titleKey: 'info-tokens.card.secretWord', fills: 'word' },
	'secret-phrase': { titleKey: 'info-tokens.card.secretPhrase', fills: 'phrase' }
};

/** A character's card, from its `infoCard` rule. */
function cardOf(id: CharacterId, characters?: CharacterLookup): CharacterCard | undefined {
	const card = rulesOf(id, characters)?.infoCard;
	return card && { id: `character:${id}:${card}`, characterId: id, ...CARDS[card], source: 'own' };
}

/**
 * The cards for these characters, in the order given. `characters` holds custom ones, whose
 * own rules block may give them a card.
 */
export function characterCardsFor(
	characterIds: readonly CharacterId[],
	characters?: CharacterLookup
): CharacterCard[] {
	return characterIds.flatMap((id) => cardOf(id, characters) ?? []);
}

/** One character's cards, its own rules block included. */
export function cardsOfCharacter(character: Character): CharacterCard[] {
	return characterCardsFor([character.id], new Map([[character.id, character]]));
}

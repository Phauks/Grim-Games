import type { CharacterId } from '#lib/core/data/index.ts';
import { plainText } from './bold.ts';

/** A card to show: its words, the characters chosen with it, and what was filled in. */
export interface ChainCard {
	text: string;
	characterIds: CharacterId[];
	/** What the Storyteller filled in, e.g. the Mezepheles's secret word. */
	detail?: string;
}

/** A filled-in card's words and answer; a card with no words (Yes/No) is only its answer. */
export function detailLabel(card: ChainCard): string {
	return plainText(card.text) ? `${plainText(card.text)}: ${card.detail}` : (card.detail ?? '');
}

/** A chain card's name for its buttons, with its characters' names. */
export function chainLabel(
	card: ChainCard,
	names: (ids: readonly CharacterId[]) => string
): string {
	if (card.detail) return detailLabel(card);
	return card.characterIds.length
		? `${plainText(card.text)} (${names(card.characterIds)})`
		: plainText(card.text);
}

/** The cards with the one at `index` moved one place up (-1) or down (1). */
export function moved<T>(cards: readonly T[], index: number, by: -1 | 1): T[] {
	const to = index + by;
	if (to < 0 || to >= cards.length) return [...cards];
	const next = [...cards];
	[next[index], next[to]] = [next[to], next[index]];
	return next;
}

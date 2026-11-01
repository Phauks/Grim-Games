import { INFO_CARDS, type InfoCard } from '../choice-rules.ts';
import { readString } from '../validate.ts';
import type { Part } from './part.ts';

/**
 * Its info card, filled in before it is shown: a secret word (the Mezepheles,
 * https://wiki.bloodontheclocktower.com/Mezepheles) or phrase (the Yaggababble,
 * https://wiki.bloodontheclocktower.com/Yaggababble). `features/info-tokens/character-cards.ts`.
 */
export const infoCard: Part<InfoCard> = {
	label: 'Info card',
	description: 'Its info card, filled in before it is shown.',
	read: (block, key, path, issues) => {
		const card = readString(block, key, path, issues, false);
		if (card === undefined) return undefined;
		if ((INFO_CARDS as readonly string[]).includes(card)) return card as InfoCard;
		issues.add(`${path}.${key}`, `expected one of ${INFO_CARDS.join(', ')}`);
		return undefined;
	}
};

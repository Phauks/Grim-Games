import { oneOf } from '../field-spec.ts';
import { specPart, type PartValue, partWords } from './part.ts';

export const INFO_CARDS = ['secret-word', 'secret-phrase', 'goal'] as const;

/**
 * Its info card, filled in before it is shown: a secret word (the Mezepheles,
 * https://wiki.bloodontheclocktower.com/Mezepheles) or phrase (the Yaggababble,
 * https://wiki.bloodontheclocktower.com/Yaggababble). `features/info-tokens/character-cards.ts`.
 */
export const infoCard = partWords(
	specPart('night', 'Info card', 'Its info card, filled in before it is shown.', oneOf(INFO_CARDS)),
	{
		'': {
			names: {
				'secret-word': 'Secret word',
				'secret-phrase': 'Secret phrase',
				goal: 'Goal'
			}
		}
	}
);

export type InfoCard = PartValue<typeof infoCard>;

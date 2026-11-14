import { optObj, T } from '../field-spec.ts';
import { specPart, type PartValue, partWords } from './part.ts';

/** What its night information is like: a number (the Chef), only once per game (the Artist). */
export const infoKind = partWords(
	specPart(
		'night',
		'Info kind',
		'What its night information is like: a number, or only once per game.',
		optObj({ number: T, oncePerGame: T })
	),
	{
		number: {
			label: 'A number'
		},
		oncePerGame: {
			label: 'Once per game'
		}
	}
);

export type InfoKind = PartValue<typeof infoKind>;

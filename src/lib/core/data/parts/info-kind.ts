import { optObj, T } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

/** What its night information is like: a number (the Chef), only once per game (the Artist). */
export const infoKind = specPart(
	'Info kind',
	'What its night information is like: a number, or only once per game.',
	optObj({ number: T, oncePerGame: T })
);

export type InfoKind = PartValue<typeof infoKind>;

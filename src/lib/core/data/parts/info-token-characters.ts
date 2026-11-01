import { readInfoTokenCharacters } from '../info-token-rules.ts';
import { objectPart } from './part.ts';

/** The characters its night step's info tokens show, filled in (`rules/info-token-characters.ts`). */
export const infoTokenCharacters = objectPart(
	'Info token characters',
	'The characters its night step’s info tokens show, filled in.',
	readInfoTokenCharacters
);

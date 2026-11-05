import { readCounter } from '../counter-rules.ts';
import { objectPart } from './part.ts';

/** Its run of tokens gains the next one each dawn or dusk (`counter-rules.ts`, plan M53). */
export const counter = objectPart(
	'Counter',
	'Its run of day or night tokens gains the next one each dawn or dusk.',
	readCounter
);

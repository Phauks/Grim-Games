import { readSwapsCharacters } from '../becomes-rules.ts';
import { objectPart } from './part.ts';

/** Its night step swaps two chosen players' characters (`becomes-rules.ts`). */
export const swapsCharacters = objectPart(
	'Swaps characters',
	'Its night step swaps two chosen players’ characters.',
	readSwapsCharacters
);

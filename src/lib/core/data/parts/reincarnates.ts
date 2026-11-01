import { readReincarnates } from '../after-death-rules.ts';
import { objectPart } from './part.ts';

/** The first players to die are reborn as Travellers (`after-death-rules.ts`). */
export const reincarnates = objectPart(
	'Reborn as Travellers',
	'The first players to die are reborn as Travellers.',
	readReincarnates
);

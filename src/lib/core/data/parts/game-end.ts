import { readGameEnd } from '../game-end-rules.ts';
import { objectPart } from './part.ts';

/** How the ability ends the game, keeps it going, or changes who wins (`rules/game-end.ts`). */
export const gameEnd = objectPart(
	'Game end',
	'How the ability ends the game, keeps it going, or changes who wins.',
	readGameEnd
);

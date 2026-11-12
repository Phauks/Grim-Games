import { booleanPart } from './part.ts';

/** It chooses a player each night and no reminder records whom (the Snake Charmer). */
export const choosesUnmarked = booleanPart(
	'night',
	'Chooses unmarked',
	'It chooses a player each night and no reminder records whom.'
);

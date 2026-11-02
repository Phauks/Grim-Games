import { booleanPart } from './part.ts';

/**
 * Its night ability can turn a player into a new Demon (the Pit-Hag,
 * https://wiki.bloodontheclocktower.com/Pit-Hag), so the Demon may change hands.
 */
export const createsDemon = booleanPart(
	'Creates a Demon',
	'Its night ability can turn a player into a new Demon.'
);

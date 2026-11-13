import { booleanPart } from './part.ts';

/**
 * All its players share one night step, however many hold it: the Storyteller wakes or acts
 * for them together (Legion, https://wiki.bloodontheclocktower.com/Legion: "Each night except
 * the first, you may decide that a player dies"). Without it, each player of a character in
 * play more than once wakes on their own step (`rules/night/copy-steps.ts`).
 */
export const oneNightStep = booleanPart(
	'night',
	'One night step',
	'All its players share one night step: the Storyteller wakes or acts for them together.'
);

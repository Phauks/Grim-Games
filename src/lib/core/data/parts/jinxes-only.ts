import { booleanPart } from './part.ts';

/**
 * Its ability is only the jinxes, which show on their own, so a game never starts with it in
 * play (the Djinn, https://wiki.bloodontheclocktower.com/Djinn; Trevor, 2026-10-17).
 */
export const jinxesOnly = booleanPart(
	'Only jinxes',
	'Its ability is only the jinxes, so a game never starts with it in play.'
);

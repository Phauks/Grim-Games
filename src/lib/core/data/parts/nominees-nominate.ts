import { tokenPart } from './part.ts';

/**
 * While its ability works and this reminder of it is in play (the Riot's Day 3), a nominee who
 * dies may nominate straight away (https://wiki.bloodontheclocktower.com/Riot).
 */
export const nomineesNominate = tokenPart(
	'Nominees nominate',
	'While this reminder is in play, each nominee who dies nominates straight away.'
);

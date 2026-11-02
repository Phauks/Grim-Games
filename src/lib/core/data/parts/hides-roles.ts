import { truePart } from './part.ts';

/**
 * While it is in play, players don't know their character or alignment until they die (the
 * Tor, https://wiki.bloodontheclocktower.com/Tor): phones show no role to a living player.
 */
export const hidesRoles = truePart(
	'Hides roles',
	'While it is in play, players learn their character and alignment only when they die.'
);

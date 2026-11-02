import { truePart } from './part.ts';

/**
 * Each night its player becomes the alignment of a living neighbour (the Cult Leader,
 * https://wiki.bloodontheclocktower.com/Cult_Leader); its night step offers the change.
 */
export const takesNeighbourAlignment = truePart(
	'Takes a neighbour’s alignment',
	'Each night its player becomes the alignment of a living neighbour.'
);

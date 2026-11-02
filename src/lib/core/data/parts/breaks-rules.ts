import { truePart } from './part.ts';

/**
 * While it is in play the Storyteller may break the game rules, so any information may be
 * given (the Atheist, https://wiki.bloodontheclocktower.com/Atheist). Read by
 * `rules/night-info/reliability.ts`.
 */
export const breaksRules = truePart(
	'Storyteller breaks rules',
	'While it is in play the Storyteller may break the game rules, so any information may be given.'
);

import { truePart } from './part.ts';

/**
 * While it is in play there is no evil team, so the Storyteller may pick seats to pretend are
 * Minions and a Demon from the script (`SetPretend`), for night steps and information that fit
 * them (the Atheist, https://wiki.bloodontheclocktower.com/Atheist: rule breaking should
 * simulate evil characters that are not in play). Read by `rules/pretend.ts`.
 */
export const pretendTeam = truePart(
	'Pretend evil team',
	'While it is in play the Storyteller may pretend some players are Minions and a Demon.'
);

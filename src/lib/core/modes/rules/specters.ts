import { SPECIAL_RULE_FORMAT, type SpecialRule } from '../types.ts';

const STREAM = 'https://www.youtube.com/watch?v=-R34QbIgDh8';

/**
 * Specters: spectators share one ability and vote during the game to control it. Still in
 * alpha (https://specters.app, listed at https://chillclocktower.com/). Its one published
 * ability, Apparition, comes from the description of the stream that presented it (Arif,
 * 2025-08-24, with Nashable, who makes Specters): each dawn one player gains the Wizard's
 * ability, everyone learns who, and it ends at the next dawn. How votes are counted isn't
 * published, so the Storyteller reads the count and decides. A special rule since
 * 2026-10-18 (Trevor: rules stack on a game mode), so Specters plays with any mode.
 */
export const SPECTERS: SpecialRule = {
	kind: 'special-rule',
	format: SPECIAL_RULE_FORMAT,
	id: 'specters',
	name: 'Specters',
	about: 'Spectators share one ability and vote during the game on how it is used.',
	sources: [
		{ title: 'PRESENTING: SPECTERS (Arif)', url: STREAM },
		{ title: 'Specters', url: 'https://specters.app' },
		{ title: 'Chill on the Clocktower', url: 'https://chillclocktower.com/' }
	],
	// The stream's description: Nashable is developing Specters.
	authors: [{ title: 'Nashable', url: STREAM }],
	unconfirmed: ['daySteps'],
	parts: {
		participants: { spectators: 'shared-ability' },
		daySteps: [
			{
				kind: 'spectator-vote',
				ability: 'Apparition',
				when: 'each-dawn',
				pick: 'player',
				grants: ['wizard'],
				lasts: 'until-next-dawn',
				cite: STREAM
			}
		]
	}
};

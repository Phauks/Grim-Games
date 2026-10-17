import { GAME_MODE_FORMAT, type GameMode } from '../types.ts';

/**
 * Specters: spectators share one ability and vote during the game to control it. Still in
 * testing; its page doesn't say what the ability is or how votes count, so those parts are
 * unconfirmed (https://specters.app, listed at https://chillclocktower.com/).
 */
export const SPECTERS: GameMode = {
	format: GAME_MODE_FORMAT,
	id: 'specters',
	name: 'Specters',
	sources: [
		{ title: 'Specters', url: 'https://specters.app' },
		{ title: 'Chill on the Clocktower', url: 'https://chillclocktower.com/' }
	],
	unconfirmed: ['participants', 'daySteps'],
	parts: {
		participants: { spectators: 'shared-ability' },
		daySteps: [{ kind: 'spectator-vote' }]
	}
};

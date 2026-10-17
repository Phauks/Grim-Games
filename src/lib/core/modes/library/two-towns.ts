import { GAME_MODE_FORMAT, type GameMode } from '../types.ts';

/**
 * Two Towns and a Boomdandy (Ekin, after Two Rooms and a Boom): two towns with their own
 * Storytellers and scripts (Zombuul and Leviathan), Boomdandy and Mayor always in play.
 * Each day a nominated representative moves players to the other town: 3 after day 1, 2
 * after days 2 and 3, 1 after days 4 and 5. A team wins by winning both towns; if they
 * split after day 5, evil wins when Boomdandy and Mayor are in one town. The Mayor/Leviathan
 * jinx refers to the Mayor's team, and a good player learns when evil takes their town.
 * https://ekins.blog/2026/04/29/two-towns-and-a-boomdandy-rules/
 */
export const TWO_TOWNS: GameMode = {
	format: GAME_MODE_FORMAT,
	id: 'two-towns-and-a-boomdandy',
	name: 'Two Towns and a Boomdandy',
	sources: [
		{
			title: 'Two Towns and a Boomdandy Rules (Ekin)',
			url: 'https://ekins.blog/2026/04/29/two-towns-and-a-boomdandy-rules/'
		}
	],
	credits: ['Ekin', 'Tyler Nafe', 'James Capelli', 'Tom R.'],
	parts: {
		pool: {
			kind: 'per-town',
			scripts: [
				{
					title: 'Two Towns and a Boomdandy 1',
					url: 'https://ekins.blog/2026/04/29/two-towns-and-a-boomdandy-rules/'
				},
				{
					title: 'Two Towns and a Boomdandy 2',
					url: 'https://ekins.blog/2026/04/29/two-towns-and-a-boomdandy-rules/'
				}
			]
		},
		counts: { kind: 'per-town', maxDifference: 1 },
		forced: { inPlay: ['boomdandy', 'mayor'] },
		ruleChanges: [{ characters: ['mayor', 'leviathan'] }],
		information: [{ characters: [] }],
		daySteps: [{ kind: 'town-representative', movesPerDay: [3, 2, 2, 1, 1] }],
		winConditions: {
			kind: 'all-towns',
			splitTiebreak: { afterDay: 5, together: ['boomdandy', 'mayor'], winner: 'evil' }
		},
		towns: { count: 2, storytellers: 2 }
	}
};

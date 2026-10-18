import { GAME_MODE_FORMAT, type GameMode } from '../types.ts';

/**
 * Whale Buffet (also called Whale Bucket, Trevor 2026-10-17): the script is every
 * character; the bag deals only a character type and each player chooses a character of that
 * type on the first night. The Storyteller may ask a player to reconsider, and evil learns
 * which characters that happened for. Atheist, Engineer and Pit-Hag are banned; Drunk,
 * Lunatic and Marionette can't be chosen; only a Demon may choose Summoner; extra copies
 * might be drunk; only Bounty Hunter's setup effect applies. All from the script's own
 * rules at https://whalebuffet.com/ and https://whalebuffet.com/script.
 */
export const WHALE_BUFFET: GameMode = {
	format: GAME_MODE_FORMAT,
	id: 'whale-buffet',
	name: 'Whale Buffet',
	about:
		'Every character is on the script. Each player draws only a character type, then chooses any character of that type to play.',
	aliases: ['Whalebuffet', 'Whale Bucket', 'Whalebucket'],
	sources: [
		{ title: 'Whalebuffet', url: 'https://whalebuffet.com/' },
		{ title: 'Whalebuffet script', url: 'https://whalebuffet.com/script' }
	],
	parts: {
		pool: {
			kind: 'all-characters',
			types: ['townsfolk', 'outsider', 'minion', 'demon', 'traveller']
		},
		restricted: {
			banned: ['atheist', 'engineer', 'pithag'],
			notChoosable: ['drunk', 'lunatic', 'marionette'],
			onlyFor: [{ characterId: 'summoner', type: 'demon' }]
		},
		setupModifiers: { kind: 'only', characters: ['bountyhunter'] },
		assignment: { kind: 'choose-own', when: 'first-night', reconsider: true },
		duplicates: { kind: 'allowed', extrasMayBeDrunk: true },
		information: [{ characters: [] }],
		// Trevor, 2026-10-18, in the project chat.
		bluffs: { kind: 'none' }
	}
};

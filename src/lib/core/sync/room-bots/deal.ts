/**
 * Characters for a test room's fake Storyteller (features/test-room): Trouble Brewing's setup by
 * player count, with Travellers past 15. Only the room sees them; no rules run on them.
 */
import type { SeatRole } from '#lib/core/sync/room-roles.ts';

const TOWNSFOLK = [
	'washerwoman',
	'librarian',
	'investigator',
	'chef',
	'empath',
	'fortuneteller',
	'undertaker',
	'monk',
	'ravenkeeper',
	'virgin',
	'slayer',
	'soldier',
	'mayor'
];
const OUTSIDERS = ['butler', 'drunk', 'recluse', 'saint'];
const MINIONS = ['poisoner', 'spy', 'scarletwoman', 'baron'];
const TRAVELLERS = ['scapegoat', 'gunslinger', 'beggar', 'bureaucrat', 'thief'];
/** Trouble Brewing's setup: outsiders and minions by player count from 5 to 15. */
const SETUP: Record<number, [outsiders: number, minions: number]> = {
	5: [0, 1],
	6: [1, 1],
	7: [0, 1],
	8: [1, 1],
	9: [2, 1],
	10: [0, 2],
	11: [1, 2],
	12: [2, 2],
	13: [0, 3],
	14: [1, 3],
	15: [2, 3]
};

const shuffle = <T>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

/** Characters for `seats` players, Trouble Brewing style; past 15 the rest are Travellers. */
export function deal(seats: number): SeatRole[] {
	const players = Math.min(Math.max(seats, 5), 15);
	const [outsiders, minions] = SETUP[players];
	const townsfolk = players - outsiders - minions - 1;
	const bag: SeatRole[] = [
		...shuffle(TOWNSFOLK)
			.slice(0, townsfolk)
			.map((id) => ({ characterId: id, alignment: 'good' as const })),
		...shuffle(OUTSIDERS)
			.slice(0, outsiders)
			.map((id) => ({ characterId: id, alignment: 'good' as const })),
		...shuffle(MINIONS)
			.slice(0, minions)
			.map((id) => ({ characterId: id, alignment: 'evil' as const })),
		{ characterId: 'imp', alignment: 'evil' }
	];
	const travellers = Array.from({ length: Math.max(0, seats - 15) }, (_, i) => ({
		characterId: TRAVELLERS[i % TRAVELLERS.length],
		alignment: Math.random() < 0.5 ? ('good' as const) : ('evil' as const)
	}));
	return shuffle(bag).slice(0, seats).concat(travellers);
}

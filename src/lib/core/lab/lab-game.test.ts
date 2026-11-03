import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { BASE_DISTRIBUTION } from '#lib/core/rules/distribution.ts';
import { labGame, labOpponents, pairingKey, stepCharacter } from './lab-game.ts';

// The Character Lab (M37): opponents come from the data, and a lab game seats the locked
// characters first and fills the rest to the standard counts (src/lib/core/rules/distribution.ts).

const data = committedGameData();
const typeOf = (id: string) => data.byId.get(id)!.type;

/** A repeatable stand-in for Math.random. */
function seeded(seed = 1): () => number {
	let s = seed;
	return () => {
		s = (s * 16807) % 2147483647;
		return (s - 1) / 2147483646;
	};
}

/** How many of each type `ids` holds, with every seated type listed (0 for none). */
function countTypes(ids: readonly string[]) {
	const out: Record<string, number> = { townsfolk: 0, outsider: 0, minion: 0, demon: 0 };
	for (const id of ids) out[typeOf(id)] = (out[typeOf(id)] ?? 0) + 1;
	return out;
}

describe('labOpponents', () => {
	it('lists every character jinxed with a locked one, with its jinxes', () => {
		const expected = data.jinxes.all
			.filter(({ characters }) => characters.includes('summoner'))
			.map(({ characters }) => characters.find((id) => id !== 'summoner'));
		const opponents = labOpponents(data, ['summoner'], { kind: 'jinxes' });
		expect(opponents.map((o) => o.id)).toEqual(expected);
		for (const o of opponents) expect(o.jinxes).toHaveLength(1);
	});

	it('joins the jinxes of every locked character, each partner once', () => {
		const one = labOpponents(data, ['philosopher'], { kind: 'jinxes' }).map((o) => o.id);
		const two = labOpponents(data, ['philosopher', 'summoner'], { kind: 'jinxes' }).map(
			(o) => o.id
		);
		expect(new Set(two).size).toBe(two.length);
		for (const id of one) expect(two).toContain(id);
	});

	it('lists a character type, or every character, without the locked ones', () => {
		const demons = labOpponents(data, ['imp'], { kind: 'type', type: 'demon' });
		expect(demons.length).toBe(data.characters.filter((c) => c.type === 'demon').length - 1);
		expect(demons.every((o) => typeOf(o.id) === 'demon')).toBe(true);
		const all = labOpponents(data, ['philosopher', 'tealady'], { kind: 'all' });
		expect(all).toHaveLength(data.characters.length - 2);
	});

	it('keeps hand-picked characters in the order picked, leaving out the locked ones', () => {
		const picked = labOpponents(data, ['philosopher'], {
			kind: 'picked',
			ids: ['bountyhunter', 'philosopher', 'chef']
		});
		expect(picked.map((o) => o.id)).toEqual(['bountyhunter', 'chef']);
		expect(picked[0].jinxes).toHaveLength(1);
	});

	it('gives a character with no jinx with the locked ones no jinxes', () => {
		const chef = labOpponents(data, ['philosopher'], { kind: 'all' }).find((o) => o.id === 'chef');
		expect(chef?.jinxes).toEqual([]);
	});
});

describe('labGame', () => {
	it('seats the locked characters first, then the opponent, filling to the counts', () => {
		const game = labGame(
			data,
			{
				playerCount: 12,
				locked: ['philosopher', 'tealady'],
				opponent: 'bountyhunter',
				place: 'in-play',
				filler: 'tb'
			},
			seeded()
		);
		expect(game.seats).toHaveLength(12);
		expect(game.seats.slice(0, 3)).toEqual(['philosopher', 'tealady', 'bountyhunter']);
		expect(new Set(game.seats).size).toBe(12);
		expect(countTypes(game.seats)).toEqual(BASE_DISTRIBUTION[12]);
		for (const id of game.seats) expect(game.script).toContain(id);
		expect(game.ruleCharacters).toEqual([]);
	});

	it('keeps an opponent that is only on the script off every seat', () => {
		const game = labGame(
			data,
			{ playerCount: 8, locked: ['philosopher'], opponent: 'chef', place: 'script', filler: 'tb' },
			seeded(7)
		);
		expect(game.seats).not.toContain('chef');
		expect(game.script).toContain('chef');
		expect(game.bluffs).not.toContain('chef');
	});

	it('makes a bluffed opponent the first Demon bluff', () => {
		const game = labGame(
			data,
			{ playerCount: 8, locked: ['imp'], opponent: 'chef', place: 'bluff', filler: 'tb' },
			seeded(3)
		);
		expect(game.bluffs[0]).toBe('chef');
		expect(game.bluffs).toHaveLength(3);
		for (const id of game.bluffs) expect(game.seats).not.toContain(id);
	});

	it('puts Fabled and Loric in play, never on a seat', () => {
		const fabled = data.characters.find((c) => c.type === 'fabled')!.id;
		const game = labGame(
			data,
			{ playerCount: 7, locked: [fabled], opponent: 'chef', place: 'in-play', filler: 'tb' },
			seeded()
		);
		expect(game.ruleCharacters).toEqual([fabled]);
		expect(game.seats).not.toContain(fabled);
		expect(game.seats[0]).toBe('chef');
		expect(countTypes(game.seats)).toEqual(BASE_DISTRIBUTION[7]);
	});

	it('fills from any official character when the edition runs out of a type', () => {
		// Trouble Brewing has one Demon; three locked Demons from other editions fill the Demon count.
		const game = labGame(
			data,
			{
				playerCount: 15,
				locked: ['zombuul', 'pukka', 'shabaloth'],
				place: 'in-play',
				filler: 'tb'
			},
			seeded()
		);
		expect(game.seats).toHaveLength(15);
		expect(new Set(game.seats).size).toBe(15);
	});

	it('seats a Traveller outside the counts', () => {
		const traveller = data.characters.find((c) => c.type === 'traveller')!.id;
		const game = labGame(
			data,
			{ playerCount: 9, locked: [traveller], place: 'in-play', filler: 'bmr' },
			seeded()
		);
		const { traveller: travellers, ...rest } = countTypes(game.seats);
		expect(travellers).toBe(1);
		expect(rest).toEqual(BASE_DISTRIBUTION[8]);
	});
});

describe('pairingKey', () => {
	it('is the same whatever order the locked characters are in', () => {
		expect(pairingKey(['tealady', 'philosopher'], 'chef')).toBe(
			pairingKey(['philosopher', 'tealady'], 'chef')
		);
	});
});

describe('stepCharacter', () => {
	const ids = data.characters.map((c) => c.id);

	it('goes to the next or previous character in roles.json order, wrapping round', () => {
		expect(stepCharacter(data, ids[0], 1)).toBe(ids[1]);
		expect(stepCharacter(data, ids[1], -1)).toBe(ids[0]);
		expect(stepCharacter(data, ids[0], -1)).toBe(ids.at(-1));
	});

	it('skips the other locked characters', () => {
		expect(stepCharacter(data, ids[0], 1, [ids[1]])).toBe(ids[2]);
	});

	it('with jinxed only, lands only on characters with a jinx', () => {
		let id = 'philosopher';
		for (let i = 0; i < 5; i++) {
			id = stepCharacter(data, id, 1, [], true)!;
			expect(data.jinxes.byCharacter.get(id)?.length).toBeGreaterThan(0);
		}
	});
});

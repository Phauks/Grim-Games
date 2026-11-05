import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { BASE_DISTRIBUTION } from '#lib/core/rules/distribution.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import {
	labGame,
	labOpponents,
	stepCharacter,
	withCustomCharacters,
	type LabSetup
} from './lab-game.ts';

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

	it('keeps a list in its order, leaving out the locked ones and unknown ids', () => {
		const listed = labOpponents(data, ['philosopher'], {
			kind: 'listed',
			ids: ['bountyhunter', 'philosopher', 'nobody', 'chef']
		});
		expect(listed.map((o) => o.id)).toEqual(['bountyhunter', 'chef']);
		expect(listed[0].jinxes).toHaveLength(1);
	});

	it('takes every character when the list is the whole table', () => {
		const all = labOpponents(data, ['philosopher', 'tealady'], {
			kind: 'listed',
			ids: data.characters.map((c) => c.id)
		});
		expect(all).toHaveLength(data.characters.length - 2);
	});

	it('gives a character with no jinx with the locked ones no jinxes', () => {
		const [chef] = labOpponents(data, ['philosopher'], { kind: 'listed', ids: ['chef'] });
		expect(chef.jinxes).toEqual([]);
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

describe('labGame follows the setup rules', () => {
	const game = (setup: Partial<LabSetup> & { locked: string[] }, seed = 1) =>
		labGame(data, { playerCount: 8, place: 'in-play', filler: 'all', ...setup }, seeded(seed));

	// https://wiki.bloodontheclocktower.com/Lil%27_Monsta
	it("Lil' Monsta is on the script but no seat, and one more Minion is dealt", () => {
		// Wiki: "During setup, remove Lil’ Monsta and add a Minion token."
		for (const seed of [1, 2, 3, 4, 5]) {
			const g = game({ locked: ['lilmonsta'] }, seed);
			expect(g.seats).not.toContain('lilmonsta');
			expect(g.script).toContain('lilmonsta');
			expect(countTypes(g.seats)).toEqual({ townsfolk: 5, outsider: 1, minion: 2, demon: 0 });
		}
	});

	// https://wiki.bloodontheclocktower.com/Lil%27_Monsta
	it("Lil' Monsta as the opponent in play is not seated either", () => {
		// Wiki: "Lil’ Monsta isn’t a player, and is instead babysat by a Minion."
		const g = game({ locked: ['poisoner'], opponent: 'lilmonsta' });
		expect(g.seats).not.toContain('lilmonsta');
		expect(countTypes(g.seats).demon).toBe(0);
	});

	// https://wiki.bloodontheclocktower.com/Baron
	it('the Baron adds two Outsiders', () => {
		// Wiki: "remove any two Townsfolk character tokens and add any two Outsider character tokens"
		const g = game({ playerCount: 7, locked: ['baron'] });
		expect(countTypes(g.seats)).toEqual({ townsfolk: 3, outsider: 2, minion: 1, demon: 1 });
	});

	// https://wiki.bloodontheclocktower.com/Legion
	it('Legion fills most seats with Legion and deals no Minion', () => {
		// Wiki: "for a 10-player game, there are roughly seven Legion and three good players"
		const g = game({ playerCount: 10, locked: ['legion'] });
		const legion = g.seats.filter((id) => id === 'legion').length;
		expect(legion).toBeGreaterThan(5);
		expect(countTypes(g.seats).minion).toBe(0);
		expect(countTypes(g.seats).demon).toBe(legion);
	});

	// https://wiki.bloodontheclocktower.com/Choirboy
	it('the Choirboy brings the King into play', () => {
		// Wiki: "if the King is not already in play, remove a Townsfolk character token and add the King character token"
		const g = game({ locked: ['choirboy'] });
		expect(g.seats.slice(0, 2)).toEqual(['choirboy', 'king']);
		expect(countTypes(g.seats)).toEqual(BASE_DISTRIBUTION[8]);
	});

	// https://wiki.bloodontheclocktower.com/Marionette
	it('the Marionette sits next to the Demon', () => {
		// Wiki: "mark a good player neighboring the Demon with the IS THE MARIONETTE reminder"
		for (const seed of [1, 2, 3, 4, 5]) {
			const seats = game({ locked: ['marionette'] }, seed).seats;
			const sides = [seats[1], seats.at(-1)!].map(typeOf);
			expect(sides).toContain('demon');
		}
	});

	// https://wiki.bloodontheclocktower.com/Drunk
	it('the Drunk thinks they are a Townsfolk not in play', () => {
		// Wiki: "remove the Drunk token and add a Townsfolk character token"
		const g = game({ locked: ['drunk'] });
		expect(g.standIns).toHaveLength(1);
		const { seat, shows } = g.standIns[0];
		expect(g.seats[seat]).toBe('drunk');
		expect(typeOf(shows)).toBe('townsfolk');
		expect(g.seats).not.toContain(shows);
		expect(g.script).toContain(shows);
	});

	// https://wiki.bloodontheclocktower.com/Marionette
	it('the Marionette thinks they are a Townsfolk not in play', () => {
		// Wiki: "remove the Marionette token and add any Townsfolk token"
		const g = game({ locked: ['marionette'] });
		const { seat, shows } = g.standIns[0];
		expect(g.seats[seat]).toBe('marionette');
		expect(typeOf(shows)).toBe('townsfolk');
		expect(g.seats).not.toContain(shows);
	});

	it('with setup tokens off, no one thinks they are someone else', () => {
		expect(game({ locked: ['drunk'], setupTokens: false }).standIns).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Heretic
	it('fills no seat with a character jinxed out by one in play', () => {
		// Wiki: "Only 1 jinxed character can be in play."
		for (const seed of [1, 2, 3, 4, 5]) {
			const seats = game({ playerCount: 15, locked: ['heretic'] }, seed).seats;
			for (const id of ['baron', 'godfather', 'lleech', 'pithag', 'spy', 'widow'])
				expect(seats).not.toContain(id);
		}
	});

	it('fills with characters that change no setup, so only the chosen ones do', () => {
		for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
			const g = game({ playerCount: 12, locked: ['chef'] }, seed);
			expect(countTypes(g.seats)).toEqual(BASE_DISTRIBUTION[12]);
			for (const id of g.seats.slice(1)) expect(rulesOf(id)?.setupModifier?.ops ?? []).toEqual([]);
		}
	});

	it('with every character, fills from any edition and keeps the script to the game', () => {
		const g = game({ playerCount: 12, locked: ['chef'] }, 9);
		expect(g.seats).toHaveLength(12);
		expect(g.script).toHaveLength(12 + g.bluffs.length);
		for (const id of g.bluffs) expect(g.seats).not.toContain(id);
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

// Plan M63 (Trevor, 2026-11-05: "functionality available to test custom characters").
describe('withCustomCharacters', () => {
	const custom = { ...data.byId.get('chef')!, id: 'lanternkeeper', name: 'Lantern Keeper' };
	const jinx = { characters: ['lanternkeeper', 'philosopher'] as const, reason: 'Test jinx.' };
	const lab = withCustomCharacters(data, [custom], [jinx]);

	it('adds the custom character and its own jinx, so the lab tests it like any other', () => {
		expect(lab.byId.get('lanternkeeper')?.name).toBe('Lantern Keeper');
		expect(lab.custom?.has('lanternkeeper')).toBe(true);
		expect(labOpponents(lab, ['lanternkeeper'], { kind: 'jinxes' }).map((o) => o.id)).toEqual([
			'philosopher'
		]);
		expect(labOpponents(lab, ['philosopher'], { kind: 'jinxes' }).map((o) => o.id)).toContain(
			'lanternkeeper'
		);
	});

	it('seats the custom character when chosen, and never deals it to the other seats', () => {
		for (let seed = 1; seed <= 20; seed++) {
			const chosen = labGame(
				lab,
				{ playerCount: 10, locked: ['lanternkeeper'], place: 'in-play', filler: 'all' },
				seeded(seed)
			);
			expect(chosen.seats[0]).toBe('lanternkeeper');
			expect(chosen.script).toContain('lanternkeeper');
			const other = labGame(
				lab,
				{ playerCount: 15, locked: ['philosopher'], place: 'in-play', filler: 'all' },
				seeded(seed)
			);
			expect(other.seats).not.toContain('lanternkeeper');
		}
	});

	it('leaves the official data as it is when there are none', () => {
		expect(withCustomCharacters(data, [], [])).toBe(data);
	});
});

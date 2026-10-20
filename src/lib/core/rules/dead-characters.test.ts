import { describe, expect, it } from 'vitest';
import type { Game } from '#lib/core/model/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { actsWhenDead, deadCharacters, reminderOwnerDead } from './dead-characters.ts';

const data = committedGameData();

const game = (seats: [string, boolean][]) =>
	({
		seats: Object.fromEntries(
			seats.map(([characterId, dead], i) => [`s${i}`, { characterId, dead }])
		)
	}) as unknown as Game;

describe('actsWhenDead', () => {
	it('is true for abilities that act on or after their death', () => {
		// The Sweetheart's drunkenness starts when they die
		// (https://wiki.bloodontheclocktower.com/Sweetheart); the Barber's swap happens on the
		// day or night they died (https://wiki.bloodontheclocktower.com/Barber); the Moonchild
		// chooses once they learn they died (https://wiki.bloodontheclocktower.com/Moonchild);
		// the Zombuul only seems dead (https://wiki.bloodontheclocktower.com/Zombuul).
		for (const id of ['sweetheart', 'barber', 'moonchild', 'zombuul', 'plaguedoctor'])
			expect(actsWhenDead(id)).toBe(true);
	});

	it('is false for abilities that end when their player dies', () => {
		// A dead Poisoner poisons no one (https://wiki.bloodontheclocktower.com/Poisoner); a
		// dead Monk protects no one (https://wiki.bloodontheclocktower.com/Monk).
		for (const id of ['poisoner', 'monk', 'washerwoman', 'imp'])
			expect(actsWhenDead(id)).toBe(false);
	});

	it('only lists characters whose ability speaks of their death', () => {
		const abilities = new Map(data.characters.map((c) => [c.id, c.ability]));
		for (const id of [
			'atheist',
			'banshee',
			'barber',
			'farmer',
			'hatter',
			'heretic',
			'klutz',
			'mayor',
			'moonchild',
			'plaguedoctor',
			'politician',
			'poppygrower',
			'puzzlemaster',
			'ravenkeeper',
			'recluse',
			'sage',
			'saint',
			'spy',
			'sweetheart',
			'zombuul'
		]) {
			expect(actsWhenDead(id)).toBe(true);
			expect(abilities.get(id)).toMatch(/die|dead|kills you/i);
		}
	});
});

describe('deadCharacters', () => {
	it('lists characters whose every player is dead, unless they act when dead', () => {
		expect(
			deadCharacters(
				game([
					['poisoner', true],
					['monk', false],
					['sweetheart', true],
					['imp', true],
					['imp', false]
				])
			)
		).toEqual(new Set(['poisoner']));
	});
});

describe('reminderOwnerDead', () => {
	// Trevor (2026-10-20): placing a reminder of a character that is already dead asks first.
	// A dead Poisoner poisons no one (https://wiki.bloodontheclocktower.com/Poisoner); the
	// Sweetheart's Drunk goes down once she dies (https://wiki.bloodontheclocktower.com/Sweetheart).
	const g = game([
		['poisoner', true],
		['sweetheart', true],
		['imp', true],
		['imp', false]
	]);
	const [poisoner, , deadImp, liveImp] = Object.keys(g.seats);

	it("asks for a dead character's reminder, never one that acts when dead", () => {
		expect(reminderOwnerDead(g, { characterId: 'poisoner' })).toBe(true);
		expect(reminderOwnerDead(g, { characterId: 'sweetheart' })).toBe(false);
		expect(reminderOwnerDead(g, { characterId: 'monk' })).toBe(false);
		expect(reminderOwnerDead(g, { characterId: 'poisoner', ownerSeatId: poisoner })).toBe(true);
	});

	it("follows the copy's owner when two players share the character", () => {
		expect(reminderOwnerDead(g, { characterId: 'imp' })).toBe(false);
		expect(reminderOwnerDead(g, { characterId: 'imp', ownerSeatId: deadImp })).toBe(true);
		expect(reminderOwnerDead(g, { characterId: 'imp', ownerSeatId: liveImp })).toBe(false);
	});
});

import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import type { Game } from '#lib/core/model/index.ts';
import {
	newGame,
	run,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { abilityState } from './ability.ts';
import {
	actsWhenDead,
	deadCharacters,
	keepsAbilityWhenDead,
	reminderOwnerDead
} from './dead-characters.ts';

const data = committedGameData();

const game = (seats: [string, boolean][]) =>
	({
		seats: Object.fromEntries(
			seats.map(([characterId, dead], i) => [`s${i}`, { characterId, dead, reminders: [] }])
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

describe('keepsAbilityWhenDead', () => {
	// https://wiki.bloodontheclocktower.com/Vigormortis : a Minion the Vigormortis kills keeps
	// their ability (its Has Ability token marks them); other players it kills are just dead.
	const cast: [string, boolean, string[]][] = [
		['poisoner', true, ['Dead', 'Has Ability']],
		['poisoner', true, ['Dead']],
		['monk', true, ['Has Ability']],
		['widow', false, ['Has Ability']],
		['vigormortis', false, []]
	];
	const { session, ctx, seats } = newGame(cast.length);
	const g = run(
		session,
		ctx,
		...cast.flatMap(([characterId, dead, labels], i): Command[] => [
			{ type: 'AssignCharacter', seatId: seats[i], characterId },
			...(dead ? [{ type: 'SetDead', seatId: seats[i], dead } as const] : []),
			...labels.map((label): Command => ({
				type: 'AddReminder',
				seatId: seats[i],
				reminder: { characterId: 'vigormortis', label }
			}))
		])
	).game;
	const [kept, killed, monk, alive] = seats;

	it('is true only for a dead Minion with the Has Ability token', () => {
		expect(keepsAbilityWhenDead(g, kept, characters)).toBe(true);
		expect(keepsAbilityWhenDead(g, killed, characters)).toBe(false);
		expect(keepsAbilityWhenDead(g, monk, characters)).toBe(false);
		expect(keepsAbilityWhenDead(g, alive, characters)).toBe(false);
	});

	it('keeps the ability working, its reminders off the dead list and unasked', () => {
		expect(abilityState(g, kept, characters)).toMatchObject({ works: true, dead: false });
		expect(abilityState(g, killed, characters)).toMatchObject({ works: false, dead: true });
		expect(deadCharacters(g, characters).has('poisoner')).toBe(false);
		expect(reminderOwnerDead(g, { characterId: 'poisoner', ownerSeatId: kept }, characters)).toBe(
			false
		);
		expect(reminderOwnerDead(g, { characterId: 'poisoner', ownerSeatId: killed }, characters)).toBe(
			true
		);
		expect(deadCharacters(g, characters).has('monk')).toBe(true);
	});
});

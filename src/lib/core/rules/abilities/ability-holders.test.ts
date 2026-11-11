/**
 * Who has a character's ability (`abilityHolders`, `abilitiesOfSeat`): a borrowed ability is the
 * whole ability, used where the character's own is (Trevor, 2026-11-03).
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Boffin
 * Wiki: https://wiki.bloodontheclocktower.com/Huntsman
 * Wiki: https://wiki.bloodontheclocktower.com/Alchemist
 * Wiki: https://wiki.bloodontheclocktower.com/Pixie
 */
import { describe, expect, it } from 'vitest';
import type { Script } from '#lib/core/data/index.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { changeableSeats, characterChanger } from './becomes.ts';
import {
	abilitiesOfSeat,
	abilityHolders,
	hasAbilityOf,
	withGainedSteps
} from './gained-abilities.ts';
import { nightOrder } from '#lib/core/rules/night/night-order.ts';

const scriptOf = (ids: string[]): Script => ({
	meta: { name: 'Holders' },
	entries: ids.map((id) => ({ kind: 'official' as const, id }))
});

describe('abilityHolders', () => {
	const script = scriptOf([
		'boffin',
		'imp',
		'huntsman',
		'damsel',
		'chef',
		'alchemist',
		'poisoner',
		'pixie',
		'drunk'
	]);
	// Seat 0 the Imp, 1 the Boffin, 2 the Damsel, 3 the Chef, 4 the Poisoner.
	const base = scenario(['imp', 'boffin', 'damsel', 'chef', 'poisoner'], { script });
	const boffinHuntsman = base.do((s) => ({
		type: 'SetHeldAbility',
		seatId: s.seat('imp'),
		via: 'boffin',
		characterId: 'huntsman'
	}));

	it('lists a player by their own character', () => {
		expect(abilityHolders(base.game, 'chef', base.characters)).toEqual([base.seat('chef')]);
		expect(abilitiesOfSeat(base.game, base.seat('chef'), base.characters)).toEqual([
			{ characterId: 'chef', how: 'own' }
		]);
	});

	it('lists the Demon the Boffin gave a good ability to', () => {
		// The Boffin's page: the Demon has a not-in-play good ability.
		const s = boffinHuntsman;
		expect(abilityHolders(s.game, 'huntsman', s.characters)).toEqual([s.seat('imp')]);
		expect(hasAbilityOf(s.game, s.seat('imp'), 'huntsman', s.characters)).toBe(true);
		// Only while the Boffin's ability works.
		const poisoned = s.poisoned('boffin');
		expect(abilityHolders(poisoned.game, 'huntsman', poisoned.characters)).toEqual([]);
	});

	it("runs a Boffin-given night ability at its step through the same query (the Huntsman's)", () => {
		// The Huntsman's page: at night they may choose a player, and the Damsel, if chosen,
		// becomes a not-in-play Townsfolk.
		const s = boffinHuntsman.newDay();
		expect(characterChanger(s.game, 'huntsman', s.characters)).toBe(s.seat('imp'));
		expect(changeableSeats(s.game, 'huntsman', s.characters)).toEqual([s.seat('damsel')]);
		const data = committedGameData();
		const inPlay = s.game.seating.flatMap((id) => {
			const c = s.characters.get(s.game.seats[id].characterId ?? '');
			return c ? [c] : [];
		});
		const steps = nightOrder({ night: 'other', sheet: data.nightSheet, inPlay, players: 5 }).steps;
		const gained = withGainedSteps(
			steps,
			s.game,
			s.characters,
			'other',
			data.nightSheet.otherNight
		).find((step) => step.gained?.characterId === 'huntsman');
		expect(gained?.gained).toMatchObject({ seatId: s.seat('imp'), status: 'has-ability' });
		// Once used, its No Ability on the Demon ends it.
		const used = s.reminder('imp', 'huntsman', 'No Ability');
		expect(characterChanger(used.game, 'huntsman', used.characters)).toBe(undefined);
	});

	it("lists the Alchemist with their Minion's ability by token", () => {
		// The Alchemist's page: they have a not-in-play Minion ability.
		const s = scenario(['poisoner', 'chef', 'imp'], { script })
			.do((at) => ({ type: 'SetAlignment', seatId: at.seat(0), alignment: 'good' }))
			.reminder(0, 'alchemist', 'Is The Alchemist');
		expect(abilitiesOfSeat(s.game, s.seat(0), s.characters)).toEqual([
			{ characterId: 'alchemist', how: 'own' },
			{ characterId: 'poisoner', how: 'token', via: 'alchemist' }
		]);
		expect(abilityHolders(s.game, 'poisoner', s.characters)).toEqual([s.seat(0)]);
	});

	it('never lists a Drunk who thinks they have the token', () => {
		// The Drunk's page: they think they are a Townsfolk, and have no ability.
		const s = scenario(['pixie', 'chef', 'imp'], { script }).drunk(0);
		expect(abilityHolders(s.game, 'pixie', s.characters)).toEqual([]);
	});
});

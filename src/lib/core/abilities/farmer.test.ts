/**
 * Farmer: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Farmer
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Farmer.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { alignmentOf } from '#lib/core/model/selectors.ts';
import { onDeathApplies, onDeathTrigger } from '#lib/core/rules/night-alerts.ts';
import { passOnSeats } from '#lib/core/rules/becomes.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Farmer', () => {
	const character = committedCharacter('farmer');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Farmer');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('farmer')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Farmer#Examples)', () => {
		it('Example 1: Alchemist becomes Farmer, skipping evil Fearmonger', () => {
			// Wiki: "Julian is the Farmer. The Demon kills him at night. Evin is the Fearmonger, and Sarah
			// is the Alchemist. Sarah becomes the Farmer that night. Evin could not become the Farmer,
			// because he is evil."
			const s = scenario(['farmer', 'fearmonger', 'alchemist', 'imp', 'chef'])
				.newDay()
				.dies('farmer', 'imp');
			const trigger = onDeathTrigger('farmer', s.characters)!;
			expect(onDeathApplies(trigger, 'imp', s.characters)).toBe(true);
			// Only the alive good players may become the Farmer: never the evil Fearmonger or the Imp.
			expect(passOnSeats(s.game, 'farmer', s.characters)).toEqual([
				s.seat('alchemist'),
				s.seat('chef')
			]);
			const after = s.becomes('alchemist', 'farmer');
			expect(after.game.seats[after.seat('alchemist')].characterId).toBe('farmer');
			expect(alignmentOf(after.game, after.seat('alchemist'))).toBe('good');
		});
		it('Example 2: Farmer chain passes to Choirboy, then Heretic', () => {
			// Wiki: "On the 2nd night, the Farmer dies. The Choirboy becomes the Farmer. On the 3rd night,
			// the new Farmer dies, and the Heretic becomes a Farmer. There is now no Heretic and no
			// Choirboy in play, and there are three Farmers in play, two of which are dead."
			const s = scenario(['farmer', 'choirboy', 'heretic', 'imp', 'poisoner', 'chef'])
				.newDay()
				.dies('farmer', 'imp')
				.becomes('choirboy', 'farmer')
				.newDay()
				.newDay()
				.dies('choirboy', 'imp');
			const trigger = onDeathTrigger('farmer', s.characters)!;
			expect(
				onDeathApplies(trigger, s.game.seats[s.seat('choirboy')].deathCause, s.characters)
			).toBe(true);
			const after = s.becomes('heretic', 'farmer');
			const ids = after.game.seating.map((id) => after.game.seats[id].characterId);
			expect(ids).not.toContain('choirboy');
			expect(ids).not.toContain('heretic');
			const farmers = after.game.seating.filter(
				(id) => after.game.seats[id].characterId === 'farmer'
			);
			expect(farmers).toHaveLength(3);
			expect(farmers.filter((id) => after.game.seats[id].dead)).toHaveLength(2);
		});
	});

	describe('who may become the Farmer (its `passesOn` rule)', () => {
		it('leaves out dead players and players already a Farmer', () => {
			const s = scenario(['farmer', 'choirboy', 'heretic', 'imp', 'poisoner', 'chef'])
				.newDay()
				.dies('farmer', 'imp')
				.becomes('choirboy', 'farmer')
				.dies('chef', 'imp');
			expect(passOnSeats(s.game, 'farmer', s.characters)).toEqual([s.seat('heretic')]);
		});

		it('is empty for a character without the rule', () => {
			const s = scenario(['farmer', 'chef', 'imp', 'poisoner', 'monk']);
			expect(passOnSeats(s.game, 'chef', s.characters)).toEqual([]);
		});
	});
});

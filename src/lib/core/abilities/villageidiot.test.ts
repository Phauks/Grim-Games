/**
 * Village Idiot: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Village_Idiot
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Village Idiot.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { infoPicker, isAllowed, isTruthful } from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Village Idiot', () => {
	const character = committedCharacter('villageidiot');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Village Idiot');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Drunk']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('villageidiot')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'selection', name: 'bag-duplicate' }]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Village_Idiot#Examples)', () => {
		it('Example 1: Drunk Village Idiot misreads; others correct', () => {
			// Wiki: "Doug, Lewis, and Amy are all Village Idiots. Doug is drunk. At night, they all
			// choose Evin, the Kazali. Doug learns that Evin is good. Lewis and Amy learn that Evin is
			// evil."
			const s = scenario([
				'villageidiot',
				'villageidiot',
				'villageidiot',
				'kazali',
				'chef',
				'witch'
			]).reminder(0, 'villageidiot', 'Drunk');
			const picker = (seat: number) =>
				infoPicker(s.game, s.seat(seat), 'villageidiot', s.characters)!;
			const evin = s.seat('kazali');
			expect(isAllowed(picker(0), { seats: [evin], yes: false })).toBe(true);
			expect(isTruthful(picker(1), { seats: [evin], yes: true })).toBe(true);
			expect(isAllowed(picker(1), { seats: [evin], yes: false })).toBe(false);
			expect(isTruthful(picker(2), { seats: [evin], yes: true })).toBe(true);
		});
		it('Example 2: Drunk Village Idiot reads Heretic; liar fakes Village Idiot', () => {
			// Wiki: "Ben and Marianna are Village Idiots. Marianna is drunk. Sarah is evil, and bluffing
			// as the Village Idiot. Ben chooses Sarah and learns that she is evil. Marianna chooses the
			// Heretic player and learns that they are good. Sarah claims to have chosen Ben and learnt
			// that he is evil."
			// Sarah is the Witch. A drunk Village Idiot may still be told the truth.
			const s = scenario([
				'villageidiot',
				'villageidiot',
				'witch',
				'heretic',
				'chef',
				'imp'
			]).reminder(1, 'villageidiot', 'Drunk');
			const ben = infoPicker(s.game, s.seat(0), 'villageidiot', s.characters)!;
			expect(isTruthful(ben, { seats: [s.seat('witch')], yes: true })).toBe(true);
			const marianna = infoPicker(s.game, s.seat(1), 'villageidiot', s.characters)!;
			expect(isTruthful(marianna, { seats: [s.seat('heretic')], yes: false })).toBe(true);
			expect(isAllowed(marianna, { seats: [s.seat('heretic')], yes: false })).toBe(true);
		});
	});
});

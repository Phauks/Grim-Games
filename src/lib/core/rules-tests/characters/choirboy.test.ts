/**
 * Choirboy: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Choirboy
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Choirboy.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { infoPicker, isAllowed, isTruthful } from '#lib/core/rules/night/info/picker.ts';
import { analyseSetup } from '#lib/core/rules/setup/setup.ts';
import { wakeConditionMet } from '#lib/core/rules/night/wakes-when.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Choirboy', () => {
	const character = committedCharacter('choirboy');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Choirboy');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('choirboy')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Choirboy#Examples)', () => {
		it('Example 1: Unprotected King dies; Choirboy learns the Imp', () => {
			// Wiki: "The Imp attacks the Empath. The Empath dies. The next night, the Imp attacks the
			// King, who is protected by the Monk. The King lives. The next night, the Imp attacks the
			// King, who is no longer protected by the Monk. The King dies. The Choirboy is woken by the
			// Storyteller and learns which player is the Imp."
			const s = scenario(['choirboy', 'king', 'imp', 'monk', 'poisoner']).dies('king');
			const picker = infoPicker(s.game, s.seat('choirboy'), 'choirboy', s.characters)!;
			expect(isTruthful(picker, { seats: [s.seat('imp')] })).toBe(true);
			expect(isAllowed(picker, { seats: [s.seat('poisoner')] })).toBe(false);
		});

		it('Example 2: Drunk Choirboy wrongly names the General', () => {
			// Wiki: "The Shabaloth kills the King. The drunk Choirboy wakes and wrongly learns that the
			// General is the Demon."
			// A Drunk who thinks they are the Choirboy may be shown anyone as the Demon.
			const s = scenario(['choirboy', 'king', 'shabaloth', 'general', 'poisoner'])
				.drunk('choirboy')
				.dies('king');
			const picker = infoPicker(s.game, s.seat('choirboy'), 'choirboy', s.characters)!;
			expect(picker.anyAllowed).toBe(true);
			expect(isAllowed(picker, { seats: [s.seat('general')] })).toBe(true);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Choirboy#How_to_Run)', () => {
		it('flags a bag with the Choirboy but no King', () => {
			// Wiki: "While setting up the game, before putting character tokens in the bag, if the King
			// is not already in play, remove a Townsfolk character token and add the King character
			// token."
			const s = scenario(['choirboy']);
			const check = (...ids: string[]) =>
				analyseSetup({ players: 7, inPlay: ids.map((id) => s.characters.get(id)!) }).warnings;
			expect(
				check('choirboy', 'chef', 'empath', 'monk', 'soldier', 'poisoner', 'imp')
			).toMatchObject([{ code: 'missing-required', characters: ['choirboy', 'king'] }]);
			expect(check('choirboy', 'king', 'empath', 'monk', 'soldier', 'poisoner', 'imp')).toEqual([]);
		});

		it('wakes only on a night the Demon killed the King', () => {
			// Wiki: "Each night except the first, if the Demon kills the King, put the Demon to sleep then
			// wake the Choirboy. Point to the Demon player then put the Choirboy to sleep."
			const s = scenario(['choirboy', 'king', 'empath', 'imp', 'poisoner']).newDay();
			const wakes = (at: Scenario, died: string[]) =>
				wakeConditionMet(
					at.game,
					'choirboy',
					at.seat('choirboy'),
					at.characters,
					new Set(died.map((id) => at.seat(id)))
				);
			expect(wakes(s, [])).toBe(false);
			expect(wakes(s.dies('king', 'imp'), ['king'])).toBe(true);
			expect(wakes(s.execute('king'), ['king'])).toBe(false);
			expect(wakes(s.dies('empath', 'imp'), ['empath'])).toBe(false);
		});
	});
});

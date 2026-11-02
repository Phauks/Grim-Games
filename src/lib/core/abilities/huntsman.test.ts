/**
 * Huntsman: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Huntsman
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Huntsman.
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
import { changeableSeats, characterChanger } from '#lib/core/rules/becomes.ts';
import { nightAnswer } from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Huntsman', () => {
	const character = committedCharacter('huntsman');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Huntsman');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('huntsman')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Huntsman#Examples)', () => {
		it('Example 1: Late correct pick turns Damsel into Undertaker', () => {
			// Wiki: "The Huntsman is woken on the 1st night, but does not use their ability. On the
			// second night, the Huntsman chooses the Damsel player. The Damsel becomes the Undertaker and
			// learns which player died today."
			const s = scenario(['huntsman', 'damsel', 'chef', 'empath', 'poisoner', 'imp'])
				.newDay()
				.execute('chef');
			expect(characterChanger(s.game, 'huntsman', s.characters)).toBe(s.seat('huntsman'));
			expect(changeableSeats(s.game, 'huntsman', s.characters)).toEqual([s.seat('damsel')]);
			const after = s
				.becomes('damsel', 'undertaker')
				.reminder('huntsman', 'huntsman', 'No Ability');
			expect(
				nightAnswer(after.game, after.seat('damsel'), 'undertaker', after.characters)
			).toMatchObject({ kind: 'character', value: 'chef' });
			expect(characterChanger(after.game, 'huntsman', after.characters)).toBeUndefined();
		});
		it('Example 2: Wrong guess; Huntsman stops waking at night', () => {
			// Wiki: "The Huntsman chooses Lachlan. Lachlan is the General, so nothing happens. The
			// Huntsman is no longer woken at night."
			const s = scenario(['huntsman', 'general', 'damsel', 'empath', 'poisoner', 'imp']);
			// Only the Damsel's player can change.
			expect(changeableSeats(s.game, 'huntsman', s.characters)).not.toContain(s.seat('general'));
			const spent = s.reminder('huntsman', 'huntsman', 'No Ability');
			expect(characterChanger(spent.game, 'huntsman', spent.characters)).toBeUndefined();
		});
	});
});

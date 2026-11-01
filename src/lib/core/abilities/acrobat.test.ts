/**
 * Acrobat: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Acrobat
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Acrobat.
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
import { deathVerdict } from '#lib/core/rules/night-deaths.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Acrobat', () => {
	const character = committedCharacter('acrobat');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Acrobat');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead', 'Chosen']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('acrobat')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Acrobat#Examples)', () => {
		it('Example 1: Acrobat picks drunk Sailor and dies', () => {
			// Wiki: "The Sailor chooses the Assassin, and the Storyteller makes the Sailor drunk. The Acrobat
			// chooses the Sailor, and dies because the Sailor is drunk."
			const s = scenario(['acrobat', 'sailor', 'assassin', 'imp', 'chef']).reminder(
				'sailor',
				'sailor',
				'Drunk'
			);
			const verdict = deathVerdict(
				s.game,
				s.seat('acrobat'),
				'acrobat',
				{ seatId: s.seat('sailor') },
				s.characters
			);
			expect(verdict).toMatchObject({
				kind: 'dies',
				seatIds: [s.seat('acrobat')],
				because: 'chosen-impaired'
			});
		});

		it('Example 2: Sober, healthy target means Acrobat survives', () => {
			// Wiki: "The Acrobat chooses the Tinker, who is sober and healthy. Nothing happens."
			const s = scenario(['acrobat', 'tinker', 'assassin', 'imp', 'chef']);
			const verdict = deathVerdict(
				s.game,
				s.seat('acrobat'),
				'acrobat',
				{ seatId: s.seat('tinker') },
				s.characters
			);
			expect(verdict).toMatchObject({ kind: 'no-death', because: 'chosen-healthy' });
		});

		it('Example 3: Poison applied later kills the Acrobat', () => {
			// Wiki: "The Acrobat chooses the Preacher. Later that night, the Pukka poisons the Preacher. The
			// Acrobat dies, because the Preacher is no longer healthy."
			const s = scenario(['acrobat', 'preacher', 'assassin', 'pukka', 'chef']);
			const chose = { seatId: s.seat('preacher') };
			expect(deathVerdict(s.game, s.seat('acrobat'), 'acrobat', chose, s.characters)).toMatchObject(
				{
					kind: 'no-death'
				}
			);
			const later = s.reminder('preacher', 'pukka', 'Poisoned');
			expect(
				deathVerdict(later.game, later.seat('acrobat'), 'acrobat', chose, later.characters)
			).toMatchObject({
				kind: 'dies',
				seatIds: [later.seat('acrobat')]
			});
		});
	});
});

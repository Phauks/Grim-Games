/**
 * Balloonist: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Balloonist
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Balloonist.
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
import { infoPicker, isAllowed } from '#lib/core/rules/night-info.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

/** Whether tonight the Balloonist may be shown the player in `shown`'s seat. */
const mayShow = (s: Scenario, shown: string) =>
	isAllowed(infoPicker(s.game, s.seat('balloonist'), 'balloonist', s.characters)!, {
		seats: [s.seat(shown)]
	});

describe('Balloonist', () => {
	const character = committedCharacter('balloonist');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Balloonist');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Know']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('balloonist')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Balloonist#Examples)', () => {
		it('Example 1: Balloonist learns three players, one each night', () => {
			// Wiki: "Abdallah is the Vizier, Lewis is the High Priestess, and Sarah is the Politician. On the
			// first night, the Balloonist learns Abdallah. On the second night, the Balloonist learns Lewis.
			// On the third night, the Balloonist learns Sarah."
			// The Know reminder marks the player shown the night before.
			const cast = [
				'balloonist',
				'vizier',
				'highpriestess',
				'politician',
				'imp',
				'poisoner',
				'chef'
			];
			const s = scenario(cast);
			expect(mayShow(s, 'vizier')).toBe(true);
			const night2 = s.reminder('vizier', 'balloonist', 'Know');
			expect(mayShow(night2, 'highpriestess')).toBe(true);
			expect(mayShow(night2, 'poisoner')).toBe(false);
			const night3 = s.reminder('highpriestess', 'balloonist', 'Know');
			expect(mayShow(night3, 'politician')).toBe(true);
			expect(mayShow(night3, 'chef')).toBe(false);
		});

		it('Example 2: Poisoned Balloonist is shown another Townsfolk', () => {
			// Wiki: "Julian is the Nightwatchman, Alex is the Sailor, and Lachlan is the Puzzlemaster. On the
			// first night, the Balloonist learns Julian. On the second night, the Poisoner chooses the
			// Balloonist. Because the Balloonist is poisoned, the Storyteller chooses to show the Balloonist
			// another Townsfolk, and the Balloonist learns Alex. On the third night, the Balloonist is sober
			// and healthy, and learns Lachlan, who is a different character type to Alex."
			const s = scenario([
				'balloonist',
				'nightwatchman',
				'sailor',
				'puzzlemaster',
				'poisoner',
				'imp'
			]);
			expect(mayShow(s, 'nightwatchman')).toBe(true);
			const night2 = s.reminder('nightwatchman', 'balloonist', 'Know');
			expect(mayShow(night2, 'sailor')).toBe(false);
			expect(mayShow(night2.poisoned('balloonist'), 'sailor')).toBe(true);
			const night3 = s.reminder('sailor', 'balloonist', 'Know');
			expect(mayShow(night3, 'puzzlemaster')).toBe(true);
			expect(mayShow(night3, 'nightwatchman')).toBe(false);
		});
	});
});

/**
 * Thief: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Thief
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Thief.
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
import { blockThreshold } from '#lib/core/rules/voting.ts';
import { total, votes } from '#lib/core/testing/votes.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Thief', () => {
	const character = committedCharacter('thief');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition tb', () => {
			expect(character.name).toBe('Thief');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Negative Vote']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('thief')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'vote', name: 'multiplier', value: -1 }]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Thief#Examples)', () => {
		// Vote weight (the Negative Vote token) waits on voting in the engine.
		it('Example 1: Negative vote; nominee still reaches five', () => {
			// Wiki: "The Thief chooses Marianna. The next day, while tallying the first vote, the
			// Storyteller counts "1... 2... 3... 2... 3... 4... 5.” The nominated player now has five
			// votes for their execution, and the nomination process continues."
			// Seven hands go up; the chosen player is the fourth counted, so the count goes 1, 2, 3,
			// back to 2, and ends on 5.
			const s = votes(
				scenario([
					'thief',
					'bureaucrat',
					'chef',
					'empath',
					'monk',
					'soldier',
					'mayor',
					'slayer',
					'imp',
					'poisoner'
				])
					.reminder('monk', 'thief', 'Negative Vote')
					.nominate('chef', 'imp'),
				'chef',
				'empath',
				'thief',
				'monk',
				'soldier',
				'mayor',
				'slayer'
			);
			expect(total(s)).toBe(5);
		});
		it('Example 2: Negative vote blocks execution; exile counts positively', () => {
			// Wiki: "The Thief chooses Abdallah. Abdallah votes for an execution, and instead of the tally
			// being six, it is four. Since 10 players are alive, the nominee is not executed today. Later
			// that day, the players are voting to exile the Gunslinger. Abdallah votes to exile, and his
			// vote counts as positive."
			// Ten alive need five; six hands make four, so nobody is executed.
			const s = votes(
				scenario([
					'thief',
					'bureaucrat',
					'chef',
					'empath',
					'monk',
					'soldier',
					'mayor',
					'slayer',
					'imp',
					'poisoner'
				])
					.reminder('chef', 'thief', 'Negative Vote')
					.nominate('empath', 'imp'),
				'chef',
				'empath',
				'monk',
				'soldier',
				'mayor',
				'slayer'
			);
			expect(total(s)).toBe(4);
			expect(blockThreshold(s.game)).toEqual({ alive: 10, needed: 5 });
		});
	});
});

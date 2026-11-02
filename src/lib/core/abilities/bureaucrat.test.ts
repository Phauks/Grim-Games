/**
 * Bureaucrat: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Bureaucrat
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Bureaucrat.
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
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';

describe('Bureaucrat', () => {
	const character = committedCharacter('bureaucrat');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition tb', () => {
			expect(character.name).toBe('Bureaucrat');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['3 Votes']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('bureaucrat')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'vote', name: 'multiplier', value: 3 }]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Bureaucrat#Examples)', () => {
		// Vote weight (the 3 Votes token) waits on voting in the engine.
		it.fails('Example 1: Triple vote brings nominee to seven', () => {
			// Wiki: "The Bureaucrat chooses Evin. The next day, when the first vote is being tallied, the
			// Storyteller counts "1... 2... 3... 4-5-6... 7.” The nominated player now has seven votes for
			// their execution, and the nomination process continues."
			scenario(['bureaucrat', 'chef', 'imp', 'monk', 'poisoner', 'empath', 'saint'])
				.reminder('chef', 'bureaucrat', '3 Votes')
				.newDay();
			engineGap(
				'M9',
				"a vote tally counts the 3 Votes player's raised hand as three (5 hands give 7)"
			);
		});
		it.fails('Example 2: Triple vote spent over four nominations', () => {
			// Wiki: "The Bureaucrat chooses Filip. The next day, Filip has a triple vote, which he uses
			// during four nominations."
			scenario(['bureaucrat', 'chef', 'imp', 'monk', 'poisoner'])
				.reminder('chef', 'bureaucrat', '3 Votes')
				.newDay();
			engineGap('M9', 'the 3 Votes player votes triple on every nomination that day');
		});
		it.fails("Example 3: Dead player's single vote still counts triple", () => {
			// Wiki: "The Bureaucrat chooses Douglas, who is dead. The next day, Douglas uses his vote
			// token to vote, and his vote counts as triple."
			scenario(['bureaucrat', 'chef', 'imp', 'monk', 'poisoner'])
				.dies('chef')
				.reminder('chef', 'bureaucrat', '3 Votes')
				.newDay();
			engineGap('M9', "a dead 3 Votes player's ghost vote counts as three");
		});
	});
});

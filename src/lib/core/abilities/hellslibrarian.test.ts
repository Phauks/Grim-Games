/**
 * Hell's Librarian: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Hell%27s_Librarian
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Hell's Librarian.
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
import { validDeathCauses } from '#lib/core/rules/death-causes.ts';
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';

describe("Hell's Librarian", () => {
	const character = committedCharacter('hellslibrarian');

	describe('data (roles.json)', () => {
		it('is a Fabled from edition fabled', () => {
			expect(character.name).toBe("Hell's Librarian");
			expect(character.type).toBe('fabled');
			expect(character.edition).toBe('fabled');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Something Bad']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('hellslibrarian')).toEqual({
				firstNight: false,
				otherNight: false
			});
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Hell%27s_Librarian#Examples)', () => {
		it.fails('Example 1: Loud players punished while rules are explained', () => {
			// Wiki: "The Storyteller is attempting to explain the voting rules to a few new
			// players. The group is loud and is not listening to the Storyteller’s requests for
			// silence, so the Storyteller declares that the Hell's Librarian is in play. Two
			// players continue to loudly talk, even though they know the possible penalty. The
			// Storyteller decides that one dies and the other loses their vote for today. All
			// players are silent whilst the rules are explained."
			// One player's death can be recorded with the Hell's Librarian as its cause; nothing yet
			// takes a living player's vote away for the day.
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp'])
				.rule('hellslibrarian')
				.reminder('chef', 'hellslibrarian', 'Something Bad')
				.reminder('empath', 'hellslibrarian', 'Something Bad');
			const causes = validDeathCauses(s.game, s.seat('chef'), s.characters).map((c) => c.cause);
			expect(causes).toContain('hellslibrarian');
			const after = s.dies('chef', 'hellslibrarian');
			expect(after.game.seats[after.seat('chef')].deathCause).toBe('hellslibrarian');
			engineGap('M9', 'a living player who may not vote today (the second loud player)');
		});
	});
});

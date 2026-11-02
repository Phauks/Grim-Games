/**
 * Harpy: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Harpy
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Harpy.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { madnessOffer } from '#lib/core/rules/madness.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Harpy', () => {
	const character = committedCharacter('harpy');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Harpy');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Mad', '2nd']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('harpy')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Harpy#Examples)', () => {
		it('Example 1: Monk made mad as Investigator to frame Engineer', () => {
			// Wiki: "The Harpy chooses the Monk and the Engineer. The Monk claims to be the Investigator
			// who saw the Engineer and campaigns for them to be executed. When challenged, they are
			// emphatic in their claims that the Engineer is most likely evil due to their information,
			// and so avoid death."
			// The Monk keeps their madness, so the Storyteller leaves both players alive.
			const s = scenario(['harpy', 'monk', 'engineer', 'imp', 'chef'])
				.reminder('monk', 'harpy', 'Mad')
				.reminder('engineer', 'harpy', '2nd')
				.newDay();
			expect(madnessOffer(s.game, 'harpy', s.seat('monk'), s.characters)).toEqual({
				characterId: 'harpy',
				seatId: s.seat('monk'),
				breaking: 'death',
				dies: [s.seat('monk'), s.seat('engineer')]
			});
			expect(madnessOffer(s.game, 'harpy', s.seat('engineer'), s.characters)).toBeUndefined();
			expect(s.game.seating.filter((id) => s.game.seats[id].dead)).toEqual([]);
		});
		it('Example 2: Oracle trusts dead Alchemist and gets killed', () => {
			// Wiki: "The Harpy chooses the Oracle and the dead Alchemist. The Oracle claims that they
			// trust the Alchemist because their Oracle information indicates that they were not evil. The
			// Storyteller declares that the Oracle dies."
			const s = scenario(['harpy', 'oracle', 'alchemist', 'imp', 'chef', 'monk'])
				.execute('alchemist')
				.reminder('oracle', 'harpy', 'Mad')
				.reminder('alchemist', 'harpy', '2nd')
				.newDay();
			// The Alchemist is already dead, so only the Oracle may die.
			expect(madnessOffer(s.game, 'harpy', s.seat('oracle'), s.characters)).toMatchObject({
				breaking: 'death',
				dies: [s.seat('oracle')]
			});
			const after = s.dies('oracle', 'harpy');
			expect(after.game.seats[after.seat('oracle')]).toMatchObject({
				dead: true,
				deathCause: 'harpy'
			});
		});
		it('Example 3: Farmer clears others, leaving target suspected', () => {
			// Wiki: "The Farmer is chosen by the Harpy. As they don't have any information themselves to
			// claim in order to imply that the other player is evil, they make a concerted effort to find
			// information that might clear each of the other living people, leaving their target as the
			// remaining Demon candidate and therefore evil by implication."
			const s = scenario(['harpy', 'farmer', 'chef', 'imp', 'empath', 'monk'])
				.reminder('farmer', 'harpy', 'Mad')
				.reminder('chef', 'harpy', '2nd')
				.newDay();
			expect(madnessOffer(s.game, 'harpy', s.seat('farmer'), s.characters)).toMatchObject({
				breaking: 'death',
				dies: [s.seat('farmer'), s.seat('chef')]
			});
			expect(s.game.seating.filter((id) => s.game.seats[id].dead)).toEqual([]);
		});
	});
});

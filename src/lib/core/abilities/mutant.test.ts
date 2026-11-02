/**
 * Mutant: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Mutant
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Mutant.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { warned } from '#lib/core/model/fixtures.test-support.ts';
import { madnessOffer } from '#lib/core/rules/madness.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

describe('Mutant', () => {
	const character = committedCharacter('mutant');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition snv', () => {
			expect(character.name).toBe('Mutant');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('mutant')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Mutant#Examples)', () => {
		/** The Storyteller executes the Mutant for breaking madness: the Mutant is the cause. */
		const executedForMadness = (s: Scenario) => {
			const offer = madnessOffer(s.game, 'mutant', s.seat('mutant'), s.characters)!;
			expect(offer).toMatchObject({ breaking: 'execution', seatId: s.seat('mutant') });
			const after = s.do((at) => ({
				type: 'Execute',
				seatId: at.seat('mutant'),
				cause: offer.characterId
			}));
			expect(after.game.seats[after.seat('mutant')]).toMatchObject({
				dead: true,
				deathCause: 'mutant'
			});
			return after;
		};

		it('Example 1: Mutant admits identity; executed immediately', () => {
			// Wiki: "Ten seconds into the first day, the Mutant says to the group that they’re the Mutant.
			// The Storyteller declares that the Mutant is executed immediately. There is no nomination
			// for an execution today, since there can be a maximum of one execution per day."
			const after = executedForMadness(scenario(['mutant', 'chef', 'empath', 'witch', 'vortox']));
			// A second execution today is flagged.
			expect(
				warned(after.session, after.ctx, { type: 'Execute', seatId: after.seat('witch') })
			).toContain('already-executed');
		});

		it("Example 2: Witch reports Mutant's Klutz claim; Mutant executed", () => {
			// Wiki: "A Witch privately talks to the Storyteller and says that Evin, who is playing the
			// Mutant, told them they are the Klutz. The Storyteller chooses to execute the Mutant
			// immediately."
			executedForMadness(scenario(['mutant', 'witch', 'chef', 'empath', 'vortox']));
		});

		it('Example 3: Silent Mutant claiming Townsfolk is executed', () => {
			// Wiki: "The Mutant tells the group that they are a Townsfolk, but does not say which one.
			// When questioned if they are the Mutant, they stay silent. After a minute or so of silence,
			// the Storyteller executes the Mutant."
			executedForMadness(scenario(['mutant', 'chef', 'empath', 'witch', 'vortox']));
		});

		it('Example 4: Fake Oracle with a winking denial, executed', () => {
			// Wiki: "The Mutant says they are the Oracle, gives some bogus Oracle information, then says
			// "By the way, I am definitely not the Mutant" while giving a subtle wink. The Storyteller
			// chooses to execute the Mutant immediately."
			executedForMadness(scenario(['mutant', 'oracle', 'chef', 'witch', 'vortox']));
		});
	});
});

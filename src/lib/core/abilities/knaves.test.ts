/**
 * Knaves: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Knaves
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Knaves.
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
import { infoPicker, isAllowed, validInformation } from '#lib/core/rules/night-info.ts';
import { savantSituation } from '#lib/core/rules/savant.ts';
import { decide } from '#lib/core/engine/index.ts';
import { storytellerVisit } from '#lib/core/rules/storytellers.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Knaves', () => {
	const character = committedCharacter('knaves');

	describe('data (roles.json)', () => {
		it('is a Loric from edition loric', () => {
			expect(character.name).toBe('Knaves');
			expect(character.type).toBe('loric');
			expect(character.edition).toBe('loric');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('knaves')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Knaves#Examples)', () => {
		it('Example 1: Chef asks the liar, gets impossible number', () => {
			// Wiki: "There are two Storytellers, Ben and Lachlan. The Chef wakes and chooses
			// Lachlan, who is the lying Storyteller. The Chef learns a "3", even though there are
			// only 2 pairs of evil players."
			const s = scenario(['chef', 'poisoner', 'imp', 'scarletwoman', 'empath', 'monk', 'soldier'])
				.rule('knaves')
				.do({ type: 'SetStorytellers', names: ['Ben', 'Lachlan'], liar: 1 }, (at) => ({
					type: 'SetStorytellerVisit',
					seatId: at.seat('chef'),
					storyteller: 1
				}));
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			// The true number is two; the lying Storyteller must give anything else.
			expect(picker.range?.truth).toBe(2);
			expect(picker).toMatchObject({ mustBeFalse: true, falseBy: 'knaves', anyAllowed: false });
			expect(isAllowed(picker, { seats: [], number: 3 })).toBe(true);
			expect(isAllowed(picker, { seats: [], number: 2 })).toBe(false);
			const numbers = validInformation(s.game, picker).map((v) => v.number);
			expect(numbers).toContain(3);
			expect(numbers).not.toContain(2);
		});
		it('Example 2: After swap, Savant picks the truthful one', () => {
			// Wiki: "Later that game, the Storytellers switch. The Savant visits Ben and Lachlan
			// and chooses Lachlan. The Savant learns 2 pieces of true information."
			const s = scenario(['savant', 'chef', 'empath', 'poisoner', 'imp'])
				.rule('knaves')
				.do({ type: 'SetStorytellers', names: ['Ben', 'Lachlan'], liar: 1 })
				.newDay()
				.do({ type: 'SwitchStorytellers' }, (at) => ({
					type: 'SetStorytellerVisit',
					seatId: at.seat('savant'),
					storyteller: 1
				}));
			expect(s.game.storytellerPair).toMatchObject({ liar: 0, switched: true });
			expect(savantSituation(s.game, s.seat('savant'), s.characters)).toMatchObject({
				mode: 'both-true',
				storyteller: { by: 'knaves', lies: false }
			});
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Knaves#How_to_Run)', () => {
		it('records the two Storytellers and which one lies', () => {
			// Wiki: "There are two Storytellers. Before the 1st night, decide which of you will tell
			// the truth, and which will lie."
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp'])
				.rule('knaves')
				.do({ type: 'SetStorytellers', names: ['Ben', 'Lachlan'], liar: 1 });
			expect(s.game.storytellerPair).toMatchObject({ names: ['Ben', 'Lachlan'], liar: 1 });
		});

		it('gives true information to a player who chooses the truthful Storyteller', () => {
			// Wiki: "Each night when a player wakes to receive information due to their ability, or
			// when a player visits the Storyteller during the day, prompt them to choose which
			// Storyteller will give them their info."
			const s = scenario(['chef', 'poisoner', 'imp', 'scarletwoman', 'empath', 'monk', 'soldier'])
				.rule('knaves')
				.do({ type: 'SetStorytellers', names: ['Ben', 'Lachlan'], liar: 1 }, (at) => ({
					type: 'SetStorytellerVisit',
					seatId: at.seat('chef'),
					storyteller: 0
				}));
			expect(storytellerVisit(s.game, s.seat('chef'), s.characters)).toEqual({
				storyteller: 0,
				by: 'knaves',
				lies: false
			});
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			expect(picker.mustBeFalse).toBeUndefined();
			expect(isAllowed(picker, { seats: [], number: 2 })).toBe(true);
		});

		it('warns when the Storytellers switch a second time', () => {
			// Wiki: "Once per game, at dusk, if both Storytellers agree, the truth-telling Storyteller
			// becomes the lying Storyteller, and the lying Storyteller becomes the truth-telling
			// Storyteller."
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp'])
				.rule('knaves')
				.do(
					{ type: 'SetStorytellers', names: ['Ben', 'Lachlan'], liar: 1 },
					{
						type: 'SwitchStorytellers'
					}
				);
			const again = decide(s.game, { type: 'SwitchStorytellers' }, s.ctx);
			expect(again.ok && again.warnings.map((w) => w.code)).toEqual(['already-switched']);
		});
	});
});

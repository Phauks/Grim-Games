/**
 * Shared tests for the Mathematician's jinxes with the Drunk and the Marionette (each page's
 * Related Jinxes on the wiki, https://wiki.bloodontheclocktower.com/Mathematician): the
 * partner's player thinks they are a Townsfolk and has no such ability, so false info they get
 * is their own character's doing. The Mathematician's own rule counts only abilities another
 * character made work abnormally; the jinx counts these too (`abnormalCounts: { counts: 'self-caused' }`).
 */
import { describe, expect, it } from 'vitest';
import type { CharacterId } from '#lib/core/data/index.ts';
import { ownJinxRules } from '#lib/core/rules/jinxes.ts';
import { answerCauses, nightAnswer, reliability } from '#lib/core/rules/night-info.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { scriptOf } from './summoner.test-support.ts';

/** The Chef's player records false info, abnormal for whatever impairs them. */
const chefShownFalse = (s: Scenario) =>
	s.do((at) => ({
		type: 'RecordNightInfo',
		seatId: at.seat('chef'),
		characterId: 'chef',
		text: 'Shown 2',
		abnormal: answerCauses(reliability(at.game, at.seat('chef'), 'chef', at.characters))
	}));

const count = (s: Scenario) =>
	nightAnswer(s.game, s.seat('mathematician'), 'mathematician', s.characters);

/**
 * The Mathematician learns that the partner's player, who thinks they are the Chef (`marks`
 * makes them the partner), got false info. Each test quotes the part of the jinx both share.
 */
export function ownAbilityTests(partner: CharacterId, marks: (s: Scenario) => Scenario) {
	const cast = ['mathematician', 'chef', 'imp', 'empath', 'monk'];
	const ids = [...cast, partner];
	const base = marks(scenario(cast, { script: scriptOf(ids) })).newDay();

	describe(`the Mathematician counts the ${partner}'s false info`, () => {
		it("is data in the Mathematician's rules", () => {
			// Wiki: "The Mathematician learns if the"
			expect(ownJinxRules(base.game, 'mathematician', partner, base.characters)).toEqual({
				abnormalCounts: { counts: 'self-caused' }
			});
		});

		it("counts the partner's player shown false info", () => {
			// Wiki: "ability yielded false info"
			const before = reliability(base.game, base.seat('chef'), 'chef', base.characters);
			expect(before.impairments.map((i) => i.source)).toMatchObject([
				{ characterId: partner, seatId: base.seat('chef') }
			]);
			const s = chefShownFalse(base);
			expect(count(s)).toMatchObject({
				kind: 'number',
				value: 1,
				because: [s.seat('chef')],
				abnormal: [{ seatId: s.seat('chef'), characterId: 'chef' }]
			});
		});

		it('counts nothing when they were not shown false info', () => {
			// Wiki: "ability yielded false info or failed to work properly"
			const s = base.do((at) => ({
				type: 'RecordNightInfo',
				seatId: at.seat('chef'),
				characterId: 'chef',
				text: 'Shown 0'
			}));
			expect(count(s)).toMatchObject({ kind: 'number', value: 0 });
		});

		it(`leaves the ${partner}'s own doing out off the jinxed script`, () => {
			// Wiki: "The Mathematician learns if the"
			// The Mathematician's own rule: only another character's ability counts.
			const plain = chefShownFalse(
				marks(scenario(cast, { script: scriptOf(['mathematician', ...cast.slice(1)]) })).newDay()
			);
			expect(count(plain)).toMatchObject({ kind: 'number', value: 0, abnormal: [] });
		});
	});
}

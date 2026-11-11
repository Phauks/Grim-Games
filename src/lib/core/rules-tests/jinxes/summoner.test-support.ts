/**
 * Shared tests for the Summoner's jinxes that several partners share (each page's Related
 * Jinxes on the wiki, https://wiki.bloodontheclocktower.com/Summoner#Related_Jinxes):
 * - with the Courtier and the Preacher, the Storyteller has the Summoner ability while its
 *   living player has none (`storytellerHas: { once: 'no-ability' }`);
 * - with the Hatter, the Kazali and the Pit-Hag, a second living Demon made by the Summoner
 *   makes deaths tonight arbitrary (`arbitraryDeaths`).
 */
import { describe, expect, it } from 'vitest';
import type { CharacterId, Script } from '#lib/core/data/index.ts';
import {
	arbitraryDeathPartners,
	arbitraryDeathsTonight,
	ownJinxRules
} from '#lib/core/rules/jinxes/jinxes.ts';
import { nightStepAlerts } from '#lib/core/rules/night/night-alerts.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

export const scriptOf = (ids: string[]): Script => ({
	meta: { name: 'Jinxed' },
	entries: ids.map((id) => ({ kind: 'official' as const, id }))
});

/**
 * While the living Summoner has no ability (`marks` takes it, by `partner`'s token), the
 * Storyteller has it: a `storyteller-has` alert at the Summoner's step.
 */
export function storytellerHasTests(partner: CharacterId, marks: (s: Scenario) => Scenario) {
	const ids = ['summoner', partner, 'chef', 'empath', 'monk', 'imp'];
	const base = scenario(['summoner', partner, 'chef', 'empath', 'monk'], {
		script: scriptOf(ids)
	});
	const alerts = (s: Scenario) =>
		nightStepAlerts(s.game, 'summoner', s.characters).filter((a) => a.kind === 'storyteller-has');

	describe('the Storyteller has the Summoner ability while the living Summoner has none', () => {
		it("is data in the Summoner's rules", () => {
			// Wiki: "If the living Summoner has no ability, the Storyteller has the Summoner ability."
			expect(ownJinxRules(base.game, 'summoner', partner, base.characters)).toEqual({
				storytellerHas: { once: 'no-ability' }
			});
		});

		it("says so at the Summoner's step once its player has no ability", () => {
			// Wiki: "If the living Summoner has no ability, the Storyteller has the Summoner ability."
			expect(alerts(base)).toEqual([]);
			const s = marks(base);
			expect(alerts(s)).toMatchObject([
				{
					seatId: s.seat('summoner'),
					source: { characterId: 'summoner', seatId: s.seat('summoner') },
					partner
				}
			]);
		});

		it('says nothing for a dead Summoner, or off the jinxed script', () => {
			// Wiki: "If the living Summoner has no ability"
			expect(alerts(marks(base).dies('summoner'))).toEqual([]);
			// Off the jinxed script, a poisoned Summoner keeps the usual night.
			const plain = scenario(['summoner', 'poisoner', 'chef', 'empath', 'monk'], {
				script: scriptOf(['summoner', 'poisoner', 'chef', 'empath', 'monk', 'imp'])
			});
			expect(alerts(plain.poisoned('summoner'))).toEqual([]);
		});
	});
}

/** A second living Demon made by the Summoner makes deaths tonight arbitrary. */
export function arbitraryDeathsTests(partner: CharacterId) {
	const ids = ['summoner', partner, 'imp', 'fanggu', 'chef', 'empath', 'monk'];
	const base = scenario(['summoner', 'imp', 'chef', 'empath', 'monk'], { script: scriptOf(ids) });
	const summons = (s: Scenario) =>
		s.do((at) => ({
			type: 'AssignCharacter',
			seatId: at.seat('chef'),
			characterId: 'fanggu',
			alignment: 'evil',
			by: 'summoner'
		}));

	describe('a second living Demon makes deaths tonight arbitrary', () => {
		it("is data in the Summoner's rules", () => {
			// Wiki: "If the Summoner creates a second living Demon, deaths tonight are arbitrary."
			expect(ownJinxRules(base.game, 'summoner', partner, base.characters)).toEqual({
				arbitraryDeaths: {}
			});
			expect(arbitraryDeathPartners(base.game, 'summoner', base.characters)).toEqual([partner]);
		});

		it('makes deaths tonight arbitrary with another Demon alive', () => {
			// Wiki: "If the Summoner creates a second living Demon, deaths tonight are arbitrary."
			const s = summons(base);
			expect(arbitraryDeathsTonight(s.game, 'summoner', s.seat('chef'), s.characters)).toBe(true);
		});

		it('leaves deaths as usual for the only living Demon, or off the jinxed script', () => {
			// Wiki: "a second living Demon"
			const alone = summons(base.dies('imp'));
			expect(
				arbitraryDeathsTonight(alone.game, 'summoner', alone.seat('chef'), alone.characters)
			).toBe(false);
			const dead = summons(base.dies('chef'));
			expect(
				arbitraryDeathsTonight(dead.game, 'summoner', dead.seat('chef'), dead.characters)
			).toBe(false);
			const plain = summons(
				scenario(['summoner', 'imp', 'chef', 'empath', 'monk'], {
					script: scriptOf(ids.filter((id) => id !== partner))
				})
			);
			expect(
				arbitraryDeathsTonight(plain.game, 'summoner', plain.seat('chef'), plain.characters)
			).toBe(false);
		});
	});
}

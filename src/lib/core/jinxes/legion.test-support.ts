/**
 * Shared tests for Legion's jinxes that several partners share (each page's Related Jinxes on
 * the wiki, https://wiki.bloodontheclocktower.com/Legion#Related_Jinxes):
 * - with the Engineer, the Hatter and the Summoner, every evil player becomes Legion when it is
 *   created (`allEvilBecome`);
 * - with the Minstrel and the Preacher, Legion keeps their ability and the partner might learn
 *   they are Legion (`partnerKeepsAbility`).
 */
import { describe, expect, it } from 'vitest';
import type { CharacterId, Script } from '#lib/core/data/index.ts';
import { alignmentOf } from '#lib/core/model/selectors.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { allEvilBecoming, ownJinxRules } from '#lib/core/rules/jinxes.ts';
import { nightStepAlerts } from '#lib/core/rules/night-alerts.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

export const scriptOf = (ids: string[]): Script => ({
	meta: { name: 'Jinxed' },
	entries: ids.map((id) => ({ kind: 'official' as const, id }))
});

/** Creating Legion by `changer`'s `changesCharacter` makes every other evil player Legion. */
export function allEvilBecomeTests(changer: CharacterId) {
	const ids = [changer, 'imp', 'poisoner', 'chef', 'empath', 'monk', 'soldier', 'legion'];
	const script = scriptOf(ids);
	const base = scenario([changer, 'imp', 'poisoner', 'chef', 'empath', 'monk', 'soldier'], {
		script
	});

	describe('every evil player becomes Legion when it is created', () => {
		it(`is data in the ${changer}'s rules`, () => {
			expect(ownJinxRules(base.game, changer, 'legion', base.characters)).toMatchObject({
				allEvilBecome: true
			});
		});

		it('turns every other evil player, alive or dead, into Legion', () => {
			// Wiki: "all evil players become Legion."
			const s = base.dies('poisoner').becomes('imp', 'legion');
			// The changer too, when it is evil (the Summoner).
			const changerEvil = alignmentOf(s.game, s.seat(changer)) === 'evil';
			expect(allEvilBecoming(s.game, changer, 'legion', s.characters)).toEqual([
				...(changerEvil ? [s.seat(changer)] : []),
				s.seat('poisoner')
			]);
		});

		it('leaves the evil team alone for any other character, or off the jinxed script', () => {
			// Wiki: "all evil players become Legion."
			const s = base.becomes('imp', 'legion');
			expect(allEvilBecoming(s.game, changer, 'imp', s.characters)).toEqual([]);
			const plain = scenario([changer, 'imp', 'poisoner', 'chef', 'empath'], {
				script: scriptOf(ids.filter((id) => id !== 'legion'))
			});
			expect(allEvilBecoming(plain.game, changer, 'legion', plain.characters)).toEqual([]);
		});
	});
}

/**
 * Legion keeps their ability against `partner`'s `impairs` token, and the partner might learn
 * they are Legion, said at the partner's night step and Legion's. `marks` puts the partner's
 * token where it would reach Legion.
 */
export function keepsAbilityTests(partner: CharacterId, marks: (s: Scenario) => Scenario) {
	const ids = [partner, 'legion', 'chef', 'empath', 'monk', 'soldier'];
	const base = scenario(['legion', 'legion', 'legion', partner, 'chef', 'empath'], {
		script: scriptOf(ids)
	});

	describe('Legion keeps their ability, and the partner might learn they are Legion', () => {
		it(`is data in the ${partner}'s rules`, () => {
			expect(ownJinxRules(base.game, partner, 'legion', base.characters)).toEqual({
				partnerKeepsAbility: true
			});
		});

		it("keeps Legion's ability with the token in play", () => {
			// Wiki: "Legion keeps their ability"
			const s = marks(base);
			for (const at of [1, 2])
				expect(abilityState(s.game, s.seat(at), s.characters).impairments).toEqual([]);
		});

		it('says the partner might learn they are Legion, only once the token is in play', () => {
			// Wiki: "might learn they are Legion."
			const learns = (s: Scenario, step: CharacterId) =>
				nightStepAlerts(s.game, step, s.characters).filter((a) => a.kind === 'might-learn');
			expect(learns(base, 'legion')).toEqual([]);
			const s = marks(base);
			const alert = {
				seatId: s.seat(partner),
				source: { characterId: partner, seatId: s.seat(partner) },
				partner: 'legion'
			};
			expect(learns(s, 'legion')).toMatchObject([alert]);
			expect(learns(s, partner)).toMatchObject([alert]);
			expect(learns(s, 'chef')).toEqual([]);
		});
	});
}

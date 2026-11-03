/**
 * Shared tests for the Vizier's jinxes that two partners share (each page's Related Jinxes on
 * the wiki, https://wiki.bloodontheclocktower.com/Vizier#Related_Jinxes):
 * - with the Alsaahir and the Investigator, the Vizier isn't declared (`notDeclared`);
 * - with the Courtier and the Preacher, a Vizier whose ability that partner took learns this
 *   and still can't die by day (`keepsProtection`).
 */
import { describe, expect, it } from 'vitest';
import type { CharacterId, Script } from '#lib/core/data/index.ts';
import { abilityState, executionSavers, protection } from '#lib/core/rules/ability.ts';
import { dayReminders, dayStateFromGame, renderReminder } from '#lib/core/rules/day-reminders.ts';
import { validDeathCauses } from '#lib/core/rules/death-causes.ts';
import { jinxRulesBetween, notDeclared } from '#lib/core/rules/jinxes.ts';
import { nightStepAlerts } from '#lib/core/rules/night-alerts.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

export const scriptOf = (ids: string[]): Script => ({
	meta: { name: 'Jinxed' },
	entries: ids.map((id) => ({ kind: 'official' as const, id }))
});

/** The Vizier's day lines, as group and text. */
function vizierLines(s: Scenario) {
	return dayReminders(
		dayStateFromGame(s.game, (id) => s.characters.get(id), undefined, s.characters)
	).groups.flatMap((g) =>
		g.reminders
			.filter((r) => r.characterId === 'vizier')
			.map((r) => ({ group: g.group, text: renderReminder(r.segments) }))
	);
}

export function notDeclaredTests(partner: CharacterId) {
	const others = ['chef', 'empath', 'poisoner', 'imp'];
	const jinxed = scriptOf(['vizier', partner, ...others]);

	describe("the Storyteller doesn't declare the Vizier", () => {
		it("is data in the Vizier's rules", () => {
			expect(jinxRulesBetween('vizier', partner)).toEqual({ notDeclared: {} });
		});

		it('holds while both are on the script, even with the partner not in play', () => {
			// Wiki: "The Storyteller doesn't declare the Vizier is in play."
			const s = scenario(['vizier', ...others], { script: jinxed });
			expect(notDeclared(s.game, 'vizier', s.characters)).toBe(true);
			const plain = scenario(['vizier', ...others], { script: scriptOf(['vizier', ...others]) });
			expect(notDeclared(plain.game, 'vizier', plain.characters)).toBe(false);
		});

		it('leaves the "known to all" line out of the day, and keeps the rest', () => {
			// Wiki: "The Storyteller doesn't declare the Vizier is in play."
			const s = scenario(['vizier', partner, ...others], { script: jinxed }).newDay();
			const lines = vizierLines(s);
			expect(lines.some((l) => l.group === 'announcement')).toBe(false);
			expect(lines).toContainEqual({ group: 'vote', text: expect.stringMatching(/is alive/) });
			const plain = scenario(['vizier', ...others], {
				script: scriptOf(['vizier', ...others])
			}).newDay();
			expect(vizierLines(plain).some((l) => l.group === 'announcement')).toBe(true);
		});
	});
}

export function keepsProtectionTests(
	partner: CharacterId,
	/** The partner's ability taking the Vizier's: its token on the Vizier. */
	takes: (s: Scenario) => Scenario
) {
	const ids = ['vizier', partner, 'chef', 'empath', 'poisoner', 'imp'];
	const base = scenario(ids, { script: scriptOf(ids) });

	describe('a Vizier who lost their ability to the partner learns this and still cannot die by day', () => {
		it("is data in the Vizier's rules", () => {
			expect(jinxRulesBetween('vizier', partner)).toEqual({ keepsProtection: {} });
		});

		it("survives the town's execution with no ability", () => {
			// Wiki: "If the Vizier loses their ability, they learn this, and cannot die during the day."
			const s = takes(base);
			const vizier = s.seat('vizier');
			expect(abilityState(s.game, vizier, s.characters).impairments).toMatchObject([
				{ source: { characterId: partner } }
			]);
			expect(executionSavers(s.game, vizier, s.characters)[0]).toEqual({
				source: { characterId: 'vizier', seatId: vizier }
			});
			expect(protection(s.game, vizier, s.characters, 'day')).toEqual({
				characterId: 'vizier',
				seatId: vizier
			});
			const flags = validDeathCauses(s.game, vizier, s.characters, { day: true }).flatMap(
				(c) => c.flags
			);
			expect(flags).toContainEqual({
				code: 'protected-by-day',
				source: { characterId: 'vizier', seatId: vizier }
			});
			const day = s.nominate('chef', 'vizier').execute('vizier');
			expect(day.game.seats[vizier].dead).toBe(false);
		});

		it('still dies by day when poisoned by another ability', () => {
			// Wiki: "If the Vizier loses their ability, they learn this, and cannot die during the day."
			const s = base.poisoned('vizier');
			expect(protection(s.game, s.seat('vizier'), s.characters, 'day')).toBeUndefined();
			expect(s.nominate('chef', 'vizier').execute('vizier').game.seats[s.seat('vizier')].dead).toBe(
				true
			);
		});

		it("learns this at the partner's step, and only once the ability is gone", () => {
			// Wiki: "If the Vizier loses their ability, they learn this, and cannot die during the day."
			const learns = (s: Scenario) =>
				nightStepAlerts(s.game, partner, s.characters).filter((a) => a.kind === 'keeps-protection');
			expect(learns(base)).toEqual([]);
			const s = takes(base);
			expect(learns(s)).toMatchObject([
				{ seatId: s.seat('vizier'), source: { characterId: 'vizier' }, works: true }
			]);
		});
	});
}

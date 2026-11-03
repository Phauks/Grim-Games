/**
 * Shared tests for a jinx night choice (`nightChoice`): the Leviathan's and Riot's jinxes
 * with the Banshee, Farmer, Ravenkeeper and Sage (each page's Related Jinxes on the wiki,
 * https://wiki.bloodontheclocktower.com/Leviathan, https://wiki.bloodontheclocktower.com/Riot).
 * In short: each night after the first the Demon picks an alive player (a good one, unless
 * the jinx says any), never one picked before; a picked partner uses its ability without
 * dying, or with `dies` is killed by the Demon and so gains its ability.
 */
import { describe, expect, it } from 'vitest';
import type { NightChoice } from '#lib/core/data/jinx-rules.ts';
import type { CharacterId, Script } from '#lib/core/data/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { castWith } from '#lib/core/model/fixtures.test-support.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { ownJinxRules } from '#lib/core/rules/jinxes.ts';
import {
	jinxChoiceMisfits,
	jinxChoiceStepId,
	jinxChosenTonight,
	nightChoosers,
	withJinxChoiceSteps
} from '#lib/core/rules/jinx-choices.ts';
import { nightStepAlerts, onDeathApplies, onDeathTrigger } from '#lib/core/rules/night-alerts.ts';
import { nightOrder, type Night } from '#lib/core/rules/night-order.ts';

const scriptOf = (ids: string[]): Script => ({
	meta: { name: 'Jinxed' },
	entries: ids.map((id) => ({ kind: 'official' as const, id }))
});

export function nightChoiceTests(demon: CharacterId, partner: CharacterId, choice: NightChoice) {
	const data = committedGameData();
	const ids = [demon, partner, 'chef', 'empath', 'poisoner', 'washerwoman', 'monk'];
	const script = scriptOf(ids);
	const cast = castWith({ script });
	// Seat 0 the Demon, 1 the partner, 4 the evil Poisoner.
	const players = [demon, partner, 'chef', 'empath', 'poisoner', 'washerwoman'];
	const chose =
		(on: number) =>
		(s: string[]): Command => ({
			type: 'UseAbility',
			seatId: s[0],
			characterId: demon,
			on: s[on]
		});
	const steps = (
		night: Night,
		game: ReturnType<typeof cast>['game'],
		ctx: ReturnType<typeof cast>['ctx']
	) => {
		const inPlay = game.seating.flatMap((s) => {
			const id = game.seats[s].characterId;
			const c = id ? ctx.characters.get(id) : undefined;
			return c ? [c] : [];
		});
		const order = nightOrder({ night, sheet: data.nightSheet, inPlay, players: inPlay.length });
		return withJinxChoiceSteps(
			order.steps,
			game,
			ctx.characters,
			night,
			data.nightSheet[night === 'first' ? 'firstNight' : 'otherNight']
		);
	};

	describe('the Demon chooses a player each night', () => {
		it(`is data in the ${demon}'s rules`, () => {
			expect(ownJinxRules({ script }, demon, partner)).toEqual({ nightChoice: choice });
		});

		it('adds a choice step on other nights, before the partner acts', () => {
			const { game, ctx } = cast(players);
			const other = steps('other', game, ctx).map((s) => s.id);
			const at = other.indexOf(jinxChoiceStepId(demon));
			expect(at).toBeGreaterThanOrEqual(0);
			expect(at).toBeLessThan(other.indexOf(partner));
			expect(at).toBeLessThan(other.indexOf('dawn'));
			expect(steps('first', game, ctx).map((s) => s.id)).not.toContain(jinxChoiceStepId(demon));
		});

		it('still chooses when the partner is not in play, so the choice gives nothing away', () => {
			const { game, ctx } = cast([demon, 'monk', 'chef', 'empath', 'poisoner', 'washerwoman']);
			expect(steps('other', game, ctx).map((s) => s.id)).toContain(jinxChoiceStepId(demon));
		});

		it('has no choice without the partner on the script', () => {
			const plain = castWith({ script: scriptOf(ids.filter((id) => id !== partner)) });
			const { game, ctx } = plain([demon, 'monk', 'chef', 'empath', 'poisoner', 'washerwoman']);
			expect(nightChoosers(game, ctx.characters)).toEqual([]);
			expect(steps('other', game, ctx).map((s) => s.id)).not.toContain(jinxChoiceStepId(demon));
		});

		it(
			choice.partner === 'dies'
				? 'a chosen partner dies and gains its ability'
				: 'a chosen partner uses its ability but does not die',
			() => {
				const { game, ctx, seats } = cast(players, chose(1));
				expect(jinxChosenTonight(game, ctx.characters)).toEqual([
					{
						seatId: seats[1],
						partner,
						by: { characterId: demon, seatId: seats[0] },
						outcome: choice.partner
					}
				]);
				const alert = { kind: 'jinx-chosen', seatId: seats[1], outcome: choice.partner };
				// At the partner's step and at the Demon's.
				expect(nightStepAlerts(game, partner, ctx.characters)).toContainEqual(
					expect.objectContaining(alert)
				);
				expect(nightStepAlerts(game, demon, ctx.characters)).toContainEqual(
					expect.objectContaining(alert)
				);
				expect(game.seats[seats[1]].dead).toBe(false);
				if (choice.partner === 'dies') {
					// Killed by the Demon, its own ability is set off as usual.
					const trigger = onDeathTrigger(partner, ctx.characters)!;
					expect(onDeathApplies(trigger, demon, ctx.characters)).toBe(true);
				}
			}
		);

		it('another player chosen sets nothing off', () => {
			const { game, ctx } = cast(players, chose(2));
			expect(jinxChosenTonight(game, ctx.characters)).toEqual([]);
			expect(
				nightStepAlerts(game, partner, ctx.characters).filter((a) => a.kind === 'jinx-chosen')
			).toEqual([]);
		});

		it('fades the dead and anyone chosen on an earlier night', () => {
			const { game, ctx, seats } = cast(players, chose(2), { type: 'NewDay' }, (s) => ({
				type: 'SetDead',
				seatId: s[3],
				dead: true,
				cause: 'execution'
			}));
			const chooser = nightChoosers(game, ctx.characters)[0];
			const misfits = jinxChoiceMisfits(game, chooser);
			expect(misfits.has(seats[2])).toBe(true);
			expect(misfits.has(seats[3])).toBe(true);
			expect(misfits.has(seats[1])).toBe(false);
			expect(misfits.has(seats[5])).toBe(false);
		});

		it(
			choice.chooses === 'good'
				? 'fades the evil: only a good player'
				: 'may choose an evil player',
			() => {
				const { game, ctx, seats } = cast(players);
				const chooser = nightChoosers(game, ctx.characters)[0];
				expect(jinxChoiceMisfits(game, chooser).has(seats[4])).toBe(choice.chooses === 'good');
			}
		);
	});
}

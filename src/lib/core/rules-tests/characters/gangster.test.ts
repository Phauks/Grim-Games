/**
 * Gangster: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Gangster
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Gangster.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { dayUseDeath } from '#lib/core/rules/day/day-claims.ts';
import { survivesFirstDeath } from '#lib/core/rules/abilities/first-death.ts';
import { gameEnds } from '#lib/core/rules/game-end/game-end.ts';
import { validDeathCauses } from '#lib/core/rules/abilities/death-causes.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { warned } from '#lib/core/model/fixtures.test-support.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Gangster', () => {
	const character = committedCharacter('gangster');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition carousel', () => {
			expect(character.name).toBe('Gangster');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('carousel');
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
			expect(nightSheetPresence('gangster')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Gangster#Examples)', () => {
		it('Example 1: Baron agrees, and the Saint dies', () => {
			// Wiki: "The Gangster neighbors the Saint and the Baron. The Gangster asks the Baron if they
			// want to kill the Saint. The Baron agrees and the Saint dies."
			const s = scenario(['gangster', 'saint', 'imp', 'chef', 'baron']).newDay();
			expect(dayUseDeath(s.game, 'gangster', s.seat('saint'), s.characters)).toBe('dies');
			const after = s.dies('saint', 'gangster');
			expect(after.game.seats[after.seat('saint')]).toMatchObject({
				dead: true,
				deathCause: 'gangster'
			});
			// Killed, not executed: the Saint's team doesn't lose.
			expect(gameEnds(after.game, after.characters)).toEqual([]);
		});
		it("Example 2: Engineer asks for Po's death; Gangster agrees", () => {
			// Wiki: "The Gangster neighbours the Chambermaid and the Poppy Grower, but they are both dead.
			// The Gangster’s two living neighbours are the Engineer and the Po. The Gangster talks with
			// the Po and offers to kill the Engineer. The Po declines. The Gangster talks with the
			// Engineer and the Engineer asks the Gangster to kill the Po. The Gangster agrees, and the Po
			// dies. Good wins."
			const cast = ['gangster', 'chambermaid', 'engineer', 'chef', 'monk', 'po', 'poppygrower'];
			const s = scenario(cast).newDay().dies('chambermaid').dies('poppygrower');
			expect(dayUseDeath(s.game, 'gangster', s.seat('chambermaid'), s.characters)).toBe('no');
			expect(dayUseDeath(s.game, 'gangster', s.seat('engineer'), s.characters)).toBe('dies');
			expect(dayUseDeath(s.game, 'gangster', s.seat('po'), s.characters)).toBe('dies');
			expect(dayUseDeath(s.game, 'gangster', s.seat('chef'), s.characters)).toBe('no');
			const after = s.dies('po', 'gangster');
			expect(gameEnds(after.game, after.characters)).toMatchObject([
				{ rule: 'demon-dead', winner: 'good', holds: [] }
			]);
		});
		it("Example 3: Fool's ability blocks Sage and Gangster's kill", () => {
			// Wiki: "The Gangster neighbours the Fool and the Sage. The Sage and the Gangster kill the
			// Fool but the Fool doesn’t die, because of the Fool's ability. The Gangster may not use their
			// ability again today."
			const s = scenario(['gangster', 'fool', 'imp', 'chef', 'sage']).newDay();
			expect(survivesFirstDeath(s.game, s.seat('fool'), 'gangster', s.characters)).toMatchObject({
				spentToken: 'No Ability'
			});
			expect(dayUseDeath(s.game, 'gangster', s.seat('fool'), s.characters)).not.toBe('dies');
			// Once a day: a second use today is logged with a warning, even after a kill that failed.
			const used = s.do((at) => ({
				type: 'UseAbility',
				seatId: at.seat('gangster'),
				characterId: 'gangster',
				on: at.seat('fool')
			}));
			expect(
				warned(used.session, used.ctx, {
					type: 'UseAbility',
					seatId: used.seat('gangster'),
					characterId: 'gangster',
					on: used.seat('sage')
				})
			).toEqual(['already-used']);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Gangster#How_to_Run)', () => {
		const kill = (at: Scenario, victim: string) =>
			({
				type: 'UseAbility',
				seatId: at.seat('gangster'),
				characterId: 'gangster',
				on: at.seat(victim)
			}) as const;

		it('may use its ability again on a later day', () => {
			// Wiki: "Once per day, the Gangster can declare that they wish to use their ability."
			const s = scenario(['gangster', 'saint', 'imp', 'chef', 'baron']).newDay();
			const used = s.do((at) => kill(at, 'saint'));
			expect(warned(used.session, used.ctx, kill(used, 'baron'))).toEqual(['already-used']);
			const tomorrow = used.newDay();
			expect(warned(tomorrow.session, tomorrow.ctx, kill(tomorrow, 'baron'))).toEqual([]);
		});

		it('offers the Gangster as a cause of death for its alive neighbours only', () => {
			// Wiki: "If so, ask if an alive neighbor agrees. If an alive neighbor agrees, the other alive
			// neighbor dies. If both alive neighbors agree, the Gangster chooses which alive neighbor
			// dies."
			const s = scenario(['gangster', 'chambermaid', 'engineer', 'chef', 'monk', 'po'])
				.newDay()
				.dies('chambermaid', 'po');
			const causes = (seat: string) =>
				validDeathCauses(s.game, s.seat(seat), s.characters, { day: true }).map((c) => c.cause);
			expect(causes('engineer')).toContain('gangster');
			expect(causes('po')).toContain('gangster');
			expect(causes('chef')).not.toContain('gangster');
			expect(causes('gangster')).not.toContain('gangster');
		});
	});
});

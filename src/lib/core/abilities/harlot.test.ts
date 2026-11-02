/**
 * Harlot: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Harlot
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Harlot.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { validDeathCauses } from '#lib/core/rules/death-causes.ts';
import { filledInfoToken } from '#lib/core/rules/info-token-characters.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';

describe('Harlot', () => {
	const character = committedCharacter('harlot');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition snv', () => {
			expect(character.name).toBe('Harlot');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead', 'Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('harlot')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Harlot#Examples)', () => {
		it('Example 1: Good Harlot dies with the Mutant they learned', () => {
			// Wiki: "The good Harlot wakes and chooses the Philosopher, who chooses to reveal. The next
			// night, the Harlot chooses the No Dashii, who chooses not to reveal. The next night, the
			// Harlot chooses the Mutant, who chooses to reveal. The Storyteller decides that the Harlot
			// and Mutant die tonight."
			const s = scenario(['harlot', 'philosopher', 'mutant', 'chef', 'witch', 'nodashii']).do(
				(at) => ({ type: 'SetAlignment', seatId: at.seat('harlot'), alignment: 'good' })
			);
			// Each chosen player is woken and shown the Harlot selected them.
			expect(filledInfoToken(s.characters.get('harlot')!, 'selected-you', 2)).toMatchObject({
				characterIds: ['harlot']
			});
			const causes = (at: typeof s, seat: 'harlot' | 'mutant') =>
				validDeathCauses(at.game, at.seat(seat), at.characters).map((c) => c.cause);
			expect(causes(s, 'harlot')).toContain('harlot');
			expect(causes(s, 'mutant')).toContain('harlot');
			const after = s
				.newDay()
				.newDay()
				.reminder('harlot', 'harlot', 'Dead')
				.reminder('mutant', 'harlot', 'Dead')
				.dies('harlot', 'harlot')
				.dies('mutant', 'harlot');
			for (const seat of ['harlot', 'mutant'] as const) {
				expect(after.game.seats[after.seat(seat)]).toMatchObject({
					dead: true,
					deathCause: 'harlot'
				});
			}
		});

		it.fails('Example 2: Evil Harlot falsely claims revealed Sage is Witch', () => {
			// Wiki: "The evil Harlot chooses the Sage, who reveals. The next day, the Harlot says the Sage is
			// actually the Witch."
			const s = scenario(['harlot', 'sage', 'chef', 'witch', 'nodashii']).do((at) => ({
				type: 'SetAlignment',
				seatId: at.seat('harlot'),
				alignment: 'evil'
			}));
			expect(s.game.seats[s.seat('harlot')].alignment).toBe('evil');
			engineGap(
				'unplanned',
				"when the chosen player agrees, the Harlot's step shows the Harlot that player's true character (the Sage), whatever the Harlot later claims"
			);
		});
	});
});

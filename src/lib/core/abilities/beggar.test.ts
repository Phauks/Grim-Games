/**
 * Beggar: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Beggar
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Beggar.
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
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';

describe('Beggar', () => {
	const character = committedCharacter('beggar');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition tb', () => {
			expect(character.name).toBe('Beggar');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('tb');
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
			expect(nightSheetPresence('beggar')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Beggar#Examples)', () => {
		// Vote tokens (the Beggar votes only with tokens given to them) wait on voting in the engine.
		it.fails('Example 1: Evil Beggar falsely calls Monk evil', () => {
			// Wiki: "The Beggar cannot vote. On the fourth day, the Monk gives her vote token to the
			// Beggar. The Beggar may now vote (once), and learns that the player is good. The Beggar is
			// evil and tells the group that the Monk player is evil."
			scenario(['beggar', 'monk', 'imp', 'chef', 'poisoner']).do((at) => ({
				type: 'SetAlignment',
				seatId: at.seat('beggar'),
				alignment: 'evil'
			}));
			engineGap(
				'M9',
				'the Beggar may vote only with a vote token a player gave them, and learns the giver is good'
			);
		});
		it.fails('Example 2: Beggar dies, losing all but one vote token', () => {
			// Wiki: "The good Beggar has three vote tokens. The Recluse gives the Beggar their vote token,
			// and the Beggar learns that they are evil. That day, the Beggar dies, and loses all their
			// vote tokens except for one."
			scenario(['beggar', 'recluse', 'imp', 'chef', 'poisoner'])
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('beggar'), alignment: 'good' }))
				.dies('beggar');
			engineGap(
				'M9',
				"a dead Beggar keeps one of the vote tokens given to them; a Recluse's gift may show as evil"
			);
		});
	});
});

/**
 * Lleech: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Lleech
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Lleech.
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
import { abilityState } from '#lib/core/rules/ability.ts';
import { gameEnds, suggestedWinner } from '#lib/core/rules/game-end.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Lleech', () => {
	const character = committedCharacter('lleech');

	describe('data (roles.json)', () => {
		it('is a Demon from edition carousel', () => {
			expect(character.name).toBe('Lleech');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead', 'Poisoned']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('lleech')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Lleech#Examples)', () => {
		it("Example 1: Poisoned Noble's death kills Lleech; good wins", () => {
			// Wiki: "The Lleech poisons the Noble. The Noble learns false information. The Lleech is
			// executed, but does not die. The next day, the Noble is executed. The Noble and the Lleech
			// die. Good wins."
			const s = scenario(['noble', 'chef', 'empath', 'monk', 'poisoner', 'lleech']).reminder(
				'noble',
				'lleech',
				'Poisoned'
			);
			expect(abilityState(s.game, s.seat('noble'), s.characters).works).toBe(false);
			const lleechExecuted = s.newDay().execute('lleech');
			expect(gameEnds(lleechExecuted.game, lleechExecuted.characters)).toEqual([]);
			const nobleExecuted = lleechExecuted.newDay().execute('noble');
			const ends = gameEnds(nobleExecuted.game, nobleExecuted.characters);
			expect(ends).toMatchObject([{ rule: 'demon-dead', winner: 'good' }]);
			expect(suggestedWinner(ends)).toBe('good');
		});
		it('Example 2: Courtier-drunk Lleech outlasts poisoned Farmer, then dies', () => {
			// Wiki: "The Lleech poisons the Farmer. The Lleech is made drunk by the Courtier. The poisoned
			// Farmer dies, and the game continues because the Lleech is also drunk. The drunk Lleech is
			// executed and dies, and good wins."
			const s = scenario(['farmer', 'courtier', 'chef', 'empath', 'poisoner', 'lleech'])
				.reminder('farmer', 'lleech', 'Poisoned')
				.reminder('lleech', 'courtier', 'Drunk 3')
				.dies('farmer', 'lleech');
			expect(gameEnds(s.game, s.characters)).toEqual([]);
			const executed = s.newDay().execute('lleech');
			const ends = gameEnds(executed.game, executed.characters);
			expect(ends).toMatchObject([{ rule: 'demon-dead', winner: 'good' }]);
			expect(suggestedWinner(ends)).toBe('good');
		});
	});
});

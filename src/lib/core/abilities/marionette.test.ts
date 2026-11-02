/**
 * Marionette: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Marionette
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Marionette.
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
import { trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { gameEnds, suggestedWinner } from '#lib/core/rules/game-end.ts';
import { infoPicker, reliability } from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Marionette', () => {
	const character = committedCharacter('marionette');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Marionette');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual(['Is The Marionette']);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('marionette')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([
				{ type: 'selection', name: 'bag-disabled' },
				{ type: 'reveal', name: 'replace-character' }
			]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Marionette#Examples)', () => {
		// Waits on the engine: a player marked Is The Marionette has no impairment for the good
		// character they think they are (the Drunk has one), so their information counts as reliable.
		it.fails('Example 1: Marionette thinks they are the Undertaker', () => {
			// Wiki: "Marianna is the Marionette, but thinks she is the Undertaker. She wakes each night to
			// learn who was executed that day, but her information is often wrong. Halfway through the
			// game, the Demon tells her that she is the Marionette."
			// She sits beside the Demon, shown the Undertaker, with the Marionette's reminder.
			// Waits on the engine (M15n): Is The Marionette gives no impairment for the good character they think they are, so their info counts as reliable.
			const s = scenario(['undertaker', 'imp', 'chef', 'empath', 'monk', 'poisoner'])
				.reminder('undertaker', 'marionette', 'Is The Marionette')
				.execute('chef');
			expect(trueCharacter(s.game, s.seat('undertaker'), s.characters)).toBe('marionette');
			expect(typeOf(s.game, s.seat('undertaker'), s.characters)).toBe('minion');
			// She has no Undertaker ability, so her information need not be true.
			expect(
				reliability(s.game, s.seat('undertaker'), 'undertaker', s.characters).unreliable
			).toBeDefined();
		});
		it('Example 2: Demon bluffs that another player is Marionette', () => {
			// Wiki: "Lachlan is the Demon. He tells Sarah that she is the Marionette. Lachlan is lying.
			// There is no Marionette."
			// Sarah is the real Chef: nothing marks her, and her information is true.
			const s = scenario(['chef', 'imp', 'empath', 'monk', 'poisoner']);
			expect(trueCharacter(s.game, s.seat('chef'), s.characters)).toBe('chef');
			expect(abilityState(s.game, s.seat('chef'), s.characters).works).toBe(true);
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			expect(picker.anyAllowed).toBe(false);
		});
		it('Example 3: Claim rejected; good wins', () => {
			// Wiki: "The Demon tells Ben that he is the Marionette. Ben thinks he is the Fortune Teller, but
			// he isn’t. Ben doesn’t believe the Demon, and executes them. Good wins."
			// Ben is the Marionette, shown the Fortune Teller; executing the Demon ends the game.
			const s = scenario(['fortuneteller', 'imp', 'chef', 'empath', 'monk', 'mayor'])
				.reminder('fortuneteller', 'marionette', 'Is The Marionette')
				.newDay()
				.execute('imp');
			expect(trueCharacter(s.game, s.seat('fortuneteller'), s.characters)).toBe('marionette');
			const ends = gameEnds(s.game, s.characters);
			expect(ends).toMatchObject([{ rule: 'demon-dead', winner: 'good' }]);
			expect(suggestedWinner(ends)).toBe('good');
		});
	});
});

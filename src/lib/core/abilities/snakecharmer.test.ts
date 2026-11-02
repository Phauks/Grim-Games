/**
 * Snake Charmer: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Snake_Charmer
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Snake Charmer.
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
import { becomesOffer } from '#lib/core/rules/becomes.ts';
import { alignmentOf, trueCharacter } from '#lib/core/model/index.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

/** The Snake Charmer's Poisoned token, whose placing offers the swap. */
const charmed = { characterId: 'snakecharmer', label: 'Poisoned' } as const;

describe('Snake Charmer', () => {
	const character = committedCharacter('snakecharmer');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition snv', () => {
			expect(character.name).toBe('Snake Charmer');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Poisoned']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('snakecharmer')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Snake_Charmer#Examples)', () => {
		it('Example 1: Snake Charmer picks Pit-Hag, nothing changes', () => {
			// Wiki: "The Snake Charmer chooses a player who is the Pit-Hag, so nothing happens. The Snake
			// Charmer simply goes to sleep. The next night, the Snake Charmer chooses themself, so nothing
			// happens."
			const s = scenario(['snakecharmer', 'pithag', 'vigormortis', 'chef', 'empath']);
			expect(becomesOffer(s.game, s.seat('pithag'), charmed, s.characters)).toBeUndefined();
			expect(becomesOffer(s.game, s.seat('snakecharmer'), charmed, s.characters)).toBeUndefined();
		});

		it('Example 2: Snake Charmer targets Vigormortis, and roles swap', () => {
			// Wiki: "The Snake Charmer chooses a player who is the Vigormortis. The Snake Charmer immediately
			// becomes the evil Vigormortis, and the Vigormortis becomes the good Snake Charmer and gets
			// poisoned."
			const s = scenario(['snakecharmer', 'pithag', 'vigormortis', 'chef', 'empath']);
			const offer = becomesOffer(s.game, s.seat('vigormortis'), charmed, s.characters);
			expect(offer).toEqual({
				into: 'swap',
				seatId: s.seat('vigormortis'),
				withSeatId: s.seat('snakecharmer')
			});
			const after = s
				.do({
					type: 'SwapCharacters',
					seatId: s.seat('vigormortis'),
					withSeatId: s.seat('snakecharmer')
				})
				.reminder('vigormortis', 'snakecharmer', 'Poisoned');
			const [charmer, demon] = [after.seat('snakecharmer'), after.seat('vigormortis')];
			expect(trueCharacter(after.game, charmer, after.characters)).toBe('vigormortis');
			expect(alignmentOf(after.game, charmer)).toBe('evil');
			expect(trueCharacter(after.game, demon, after.characters)).toBe('snakecharmer');
			expect(alignmentOf(after.game, demon)).toBe('good');
			expect(abilityState(after.game, demon, after.characters).impairments).toMatchObject([
				{ reason: 'poisoned', source: { characterId: 'snakecharmer' } }
			]);
		});

		it('Example 3: Fang Gu swaps with Snake Charmer, both evil', () => {
			// Wiki: "The Pit-Hag turns themself into the Snake Charmer. Then, the Snake Charmer chooses a
			// player who is the Fang Gu. The Snake Charmer becomes the Fang Gu, while the Fang Gu becomes the
			// Snake Charmer and gets poisoned. Both remain evil."
			const s = scenario(['pithag', 'fanggu', 'chef', 'empath', 'mutant', 'monk']).becomes(
				'pithag',
				'snakecharmer'
			);
			expect(alignmentOf(s.game, s.seat('pithag'))).toBe('evil');
			const offer = becomesOffer(s.game, s.seat('fanggu'), charmed, s.characters);
			expect(offer).toEqual({
				into: 'swap',
				seatId: s.seat('fanggu'),
				withSeatId: s.seat('pithag')
			});
			const after = s
				.do({ type: 'SwapCharacters', seatId: s.seat('fanggu'), withSeatId: s.seat('pithag') })
				.reminder('fanggu', 'snakecharmer', 'Poisoned');
			expect(trueCharacter(after.game, after.seat('pithag'), after.characters)).toBe('fanggu');
			expect(trueCharacter(after.game, after.seat('fanggu'), after.characters)).toBe(
				'snakecharmer'
			);
			expect(alignmentOf(after.game, after.seat('pithag'))).toBe('evil');
			expect(alignmentOf(after.game, after.seat('fanggu'))).toBe('evil');
			expect(abilityState(after.game, after.seat('fanggu'), after.characters).works).toBe(false);
		});
	});
});

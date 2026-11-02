/**
 * Ventriloquist: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Ventriloquist
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Ventriloquist.
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
import { executionSavers } from '#lib/core/rules/ability.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Ventriloquist', () => {
	const character = committedCharacter('ventriloquist');

	describe('data (roles.json)', () => {
		it('is a Loric from edition loric', () => {
			expect(character.name).toBe('Ventriloquist');
			expect(character.type).toBe('loric');
			expect(character.edition).toBe('loric');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Mad']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('ventriloquist')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Ventriloquist#Examples)', () => {
		const saverOf = (s: ReturnType<typeof scenario>, seat: string) =>
			executionSavers(s.game, s.seat(seat), s.characters).find(
				(v) => v.source.characterId === 'ventriloquist'
			);

		it('Example 1: Gambler switches to Hatter, survives execution', () => {
			// Wiki: "Abdallah is the Gambler. On the 1st day, he is mad that he is the Gambler.
			// When nominated, he is mad that he is the Hatter. Later that day, Abdallah is executed
			// and does not die."
			// Mad as a new character when nominated: the Mad reminder lets the Storyteller save them.
			const s = scenario(['gambler', 'chef', 'empath', 'poisoner', 'imp'])
				.rule('ventriloquist')
				.reminder('gambler', 'ventriloquist', 'Mad');
			expect(saverOf(s, 'gambler')).toEqual({
				source: { characterId: 'ventriloquist', reminderId: expect.any(String) }
			});
			const after = s.do((at) => ({
				type: 'Execute',
				seatId: at.seat('gambler'),
				savedBy: 'ventriloquist'
			}));
			expect(after.game.seats[after.seat('gambler')].dead).toBe(false);
		});
		it('Example 2: Professor switches from Empath to Huntsman, survives', () => {
			// Wiki: "Marianna is the Professor. She has been claiming to be the Empath all game.
			// When nominated, she claims to be the Huntsman. When executed, Marianna does not die."
			const s = scenario(['professor', 'chef', 'empath', 'poisoner', 'imp'])
				.rule('ventriloquist')
				.reminder('professor', 'ventriloquist', 'Mad');
			expect(saverOf(s, 'professor')?.problem).toBeUndefined();
			const after = s.do((at) => ({
				type: 'Execute',
				seatId: at.seat('professor'),
				savedBy: 'ventriloquist'
			}));
			expect(after.game.seats[after.seat('professor')].dead).toBe(false);
		});
		it('Example 3: Hermit repeating Knight claim gets no protection', () => {
			// Wiki: "Julian is the Hermit. Julian is quiet for 3 days. When nominated, Julian is
			// mad as the Knight, and says that Evin and Alex are not the Demon. When executed,
			// Julian dies, because he was not mad as a fresh character."
			// Not mad as a fresh character, so no Mad reminder: the Ventriloquist doesn't cover them.
			const s = scenario(['hermit', 'chef', 'empath', 'poisoner', 'imp']).rule('ventriloquist');
			expect(saverOf(s, 'hermit')?.problem).toBe('not-this-player');
			const after = s.execute('hermit');
			expect(after.game.seats[after.seat('hermit')]).toMatchObject({
				dead: true,
				deathCause: 'execution'
			});
		});
	});
});

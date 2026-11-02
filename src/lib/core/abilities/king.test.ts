/**
 * King: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/King
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes King.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { infoPicker, isAllowed, isTruthful } from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { wakeConditionMet } from '#lib/core/rules/wakes-when.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('King', () => {
	const character = committedCharacter('king');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('King');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('king')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/King#Examples)', () => {
		it('Example 1: King learns an alive Snitch, then an alive Witch', () => {
			// Wiki: "Amy is the King. There are 12 players alive, and one dead player. On the second
			// night, she learns nothing. On the third night, she learns nothing. On the fourth day, there
			// are 7 dead players and 6 alive players. On the fourth night, Amy learns that the Snitch is
			// alive. On the fifth night, she learns that the Witch is alive."
			// Once enough players are dead the King is shown alive characters, good or evil; a
			// dead player's character is not one of them. Before then the King doesn't wake
			// (`wakesWhen`, rules/wakes-when.test.ts).
			const s = scenario(['king', 'snitch', 'witch', 'monk', 'imp']).dies('monk').dies('imp');
			const picker = infoPicker(s.game, s.seat('king'), 'king', s.characters)!;
			expect(isTruthful(picker, { seats: [s.seat('snitch')], characterId: 'snitch' })).toBe(true);
			expect(isTruthful(picker, { seats: [s.seat('witch')], characterId: 'witch' })).toBe(true);
			expect(isAllowed(picker, { seats: [s.seat('monk')], characterId: 'monk' })).toBe(false);
		});
		it('Example 2: Demon kills King, risking a fake Choirboy', () => {
			// Wiki: "The Demon knows that Abdallah is the King. Evin is claiming to be the Choirboy, but is
			// the Butler. The Demon takes a risk and kills Abdallah. If Evin was actually the Choirboy,
			// he would have learnt which player was the Demon."
			const s = scenario(['king', 'butler', 'imp', 'chef', 'monk']).dies('king', 'imp');
			const tonight = new Set([s.seat('king')]);
			// No player is the Choirboy, so no one wakes to learn the Demon.
			expect(s.game.seating.some((id) => s.game.seats[id].characterId === 'choirboy')).toBe(false);
			// Had Evin been the Choirboy, he would wake and learn the Imp's player.
			const real = scenario(['king', 'choirboy', 'imp', 'chef', 'monk']).dies('king', 'imp');
			expect(
				wakeConditionMet(real.game, 'choirboy', real.seat('choirboy'), real.characters, tonight)
			).toBe(true);
			const picker = infoPicker(real.game, real.seat('choirboy'), 'choirboy', real.characters)!;
			expect(isTruthful(picker, { seats: [real.seat('imp')] })).toBe(true);
			expect(isTruthful(picker, { seats: [real.seat('chef')] })).toBe(false);
		});
	});
});

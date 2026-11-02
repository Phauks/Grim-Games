/**
 * Goblin: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Goblin
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Goblin.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { endCharacters } from '#lib/core/rules/end-reason.ts';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Goblin', () => {
	const character = committedCharacter('goblin');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Goblin');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Claimed']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('goblin')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Goblin#Examples)', () => {
		const cast = ['goblin', 'artist', 'imp', 'chef', 'monk', 'empath'];

		it.fails("Example 1: Goblin's public claim leads to evil victory", () => {
			// Wiki: "Abdallah is the Goblin. Alex nominates Abdallah, and Abdallah claims to be the
			// Goblin. Votes are counted, and Abdallah is about to die. Other nominations occur later
			// today, but Abdallah has the most votes and is executed. Evil wins."
			// Waits on the engine: gameEnds has no end for executing the Goblin who claimed today.
			const s = scenario(cast)
				.newDay()
				.nominate('chef', 'goblin')
				.reminder('goblin', 'goblin', 'Claimed')
				.nominate('monk', 'empath')
				.execute('goblin');
			expect(endCharacters(s.game, s.characters)).toContain('goblin');
			expect(gameEnds(s.game, s.characters)).toMatchObject([{ winner: 'evil' }]);
		});
		it("Example 2: Artist's false Goblin claim changes nothing", () => {
			// Wiki: "Lewis is the Artist, and claims to be the Goblin when nominated. He is executed, and
			// the game continues."
			const s = scenario(cast)
				.newDay()
				.nominate('chef', 'artist')
				.reminder('artist', 'goblin', 'Claimed')
				.execute('artist');
			expect(gameEnds(s.game, s.characters)).toEqual([]);
		});
		it("Example 3: Yesterday's Goblin claim doesn't count today", () => {
			// Wiki: "Doug is the Goblin. He claimed to be the Goblin yesterday and the day before, but not
			// today. He is executed. The game continues."
			const s = scenario(cast)
				.newDay()
				.nominate('chef', 'goblin')
				.newDay()
				.nominate('monk', 'goblin')
				.newDay()
				.nominate('empath', 'goblin')
				.execute('goblin');
			expect(gameEnds(s.game, s.characters)).toEqual([]);
		});
	});
});

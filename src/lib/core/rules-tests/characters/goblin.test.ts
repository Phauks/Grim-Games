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
import { endCharacters } from '#lib/core/rules/game-end/end-reason.ts';
import { gameEnds } from '#lib/core/rules/game-end/game-end.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';

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

		it("Example 1: Goblin's public claim leads to evil victory", () => {
			// Wiki: "Abdallah is the Goblin. Alex nominates Abdallah, and Abdallah claims to be the
			// Goblin. Votes are counted, and Abdallah is about to die. Other nominations occur later
			// today, but Abdallah has the most votes and is executed. Evil wins."
			// Waits on the engine (M15l): gameEnds has no end for executing the Goblin who claimed today.
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

	describe('How to Run (https://wiki.bloodontheclocktower.com/Goblin#How_to_Run)', () => {
		const cast = ['goblin', 'artist', 'imp', 'chef', 'monk', 'empath'];

		it('puts Claimed only on the Goblin', () => {
			// Wiki: "If the Goblin claims to be the Goblin when nominated (and before voting begins),
			// declare that this player has claimed to be the Goblin, so that all the group hears. Put
			// the CLAIMED reminder by the Goblin token."
			const s = scenario(cast);
			const claimed = { characterId: 'goblin', label: 'Claimed' };
			expect(reminderTargetMisses(s.game, claimed, s.seat('goblin'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, claimed, s.seat('artist'), s.characters)).toEqual([
				'not-self'
			]);
		});

		it('ends the game for evil when the Goblin marked Claimed is executed', () => {
			// Wiki: "If the Goblin is executed, and they are marked CLAIMED, then declare that evil
			// wins."
			const s = scenario(cast).newDay().reminder('goblin', 'goblin', 'Claimed');
			expect(gameEnds(s.game, s.characters)).toEqual([]);
			const executed = s.execute('goblin');
			expect(gameEnds(executed.game, executed.characters)).toMatchObject([
				{ characterId: 'goblin', winner: 'evil' }
			]);
		});
	});
});

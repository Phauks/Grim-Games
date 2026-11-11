/**
 * Poppy Grower: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Poppy_Grower
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Poppy Grower.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { deathReminder } from '#lib/core/rules/abilities/first-death.ts';
import { defaultAlignment } from '#lib/core/data/index.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { demonInfo } from '#lib/core/rules/night/evil-info.ts';
import { withNightInfo } from '#lib/core/rules/night/info/steps.ts';
import { nightOrder } from '#lib/core/rules/night/night-order.ts';
import { type Night } from '#lib/core/model/overrides.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

describe('Poppy Grower', () => {
	const character = committedCharacter('poppygrower');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Poppy Grower');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Evil Wakes']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('poppygrower')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Poppy_Grower#Examples)', () => {
		it("Example 1: Evil players don't learn each other", () => {
			// Wiki: "The Imp, the Poisoner and the Witch are in play. On the first night, the Imp wakes
			// to learn 3 not-in-play characters, but does not learn which players are the Minions. The
			// Poisoner and the Witch do not wake to learn who each other are, and do not learn who the
			// Demon is."
			const s = scenario(['poppygrower', 'chef', 'imp', 'poisoner', 'witch', 'empath', 'monk']);
			expect(demonInfo(s.game, s.characters).hiddenBy).toBe('poppygrower');
		});
		it('Example 2: Evil learn each other once the Poppy Grower dies', () => {
			// Wiki: "The Poppy Grower is executed, and dies. That night, the Shabaloth learns which
			// players are the Minions. The Godfather and the Baron wake, make eye contact, and learn
			// which player is the Shabaloth."
			const s = scenario(['poppygrower', 'chef', 'shabaloth', 'godfather', 'baron', 'empath']);
			expect(demonInfo(s.game, s.characters).hiddenBy).toBe('poppygrower');
			const after = s.execute('poppygrower');
			expect(demonInfo(after.game, after.characters).hiddenBy).toBeUndefined();
		});
		it("Example 3: Drunk Poppy Grower's death leaves evil unaware", () => {
			// Wiki: "The Poppy Grower is the Drunk. On the 1st night, the evil players learn who each
			// other are, as normal. On the fourth night, the Demon kills the Poppy Grower. The Demons
			// and Minions do not wake to learn who each other are again because the Poppy Grower is
			// the Drunk."
			const s = scenario(['poppygrower', 'chef', 'imp', 'poisoner', 'empath', 'monk']).drunk(
				'poppygrower'
			);
			expect(demonInfo(s.game, s.characters).hiddenBy).toBeUndefined();
			const later = s.newDay().newDay().newDay().dies('poppygrower', 'imp');
			expect(demonInfo(later.game, later.characters).hiddenBy).toBeUndefined();
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Poppy_Grower#How_to_Run)', () => {
		it('marking the player dead asks to place Evil Wakes on them', () => {
			// Wiki: "If the Poppy Grower dies, mark them with the EVIL WAKES reminder."
			const s = scenario(['poppygrower', 'chef', 'empath', 'imp', 'poisoner']);
			for (const cause of ['execution', 'imp', 'poisoner'] as const) {
				const dead = s.dies('poppygrower', cause);
				expect(deathReminder(dead.game, dead.seat('poppygrower'), cause, dead.characters)).toEqual({
					characterId: 'poppygrower',
					label: 'Evil Wakes'
				});
			}
		});

		const cast = ['poppygrower', 'chef', 'imp', 'poisoner', 'witch', 'empath', 'monk'];
		const steps = (s: Scenario, night: Night) => {
			const data = committedGameData();
			const inPlay = s.game.seating.map((id) => data.byId.get(s.game.seats[id].characterId!)!);
			const sheet = night === 'first' ? data.nightSheet.firstNight : data.nightSheet.otherNight;
			return withNightInfo(
				nightOrder({ night, sheet: data.nightSheet, inPlay, players: inPlay.length }).steps,
				s.game,
				s.characters,
				night,
				{ died: [] },
				sheet
			);
		};

		it('notes at the Minion info and Demon info steps that evil does not learn each other', () => {
			// Wiki: "During the first night, wake the Demon. Show the THESE CHARACTERS ARE NOT IN PLAY
			// info token, then any three good character tokens that are not in play. Then, put the
			// Demon to sleep. Do not do the Minion Info and Demon Info steps."
			const s = scenario(cast);
			for (const marker of ['minioninfo', 'demoninfo']) {
				const step = steps(s, 'first').find((step) => step.id === marker);
				expect(step?.notes.some((note) => note.startsWith('Poppy Grower:'))).toBe(true);
			}
		});

		it('allows Evil Wakes only on the Poppy Grower once they have died', () => {
			// Wiki: "If the Poppy Grower dies, mark them with the EVIL WAKES reminder."
			const s = scenario(cast);
			const token = { characterId: 'poppygrower', label: 'Evil Wakes' };
			expect(reminderTargetMisses(s.game, token, s.seat('poppygrower'), s.characters)).not.toEqual(
				[]
			);
			const dead = s.execute('poppygrower');
			expect(
				reminderTargetMisses(dead.game, token, dead.seat('poppygrower'), dead.characters)
			).toEqual([]);
			expect(reminderTargetMisses(dead.game, token, dead.seat('chef'), dead.characters)).toContain(
				'not-self'
			);
		});

		it('adds the Minion info and Demon info steps the night the Poppy Grower died', () => {
			// Wiki: "That night, wake the Minions and let them make eye contact. Show the THIS IS THE
			// DEMON info token, then point to the Demon. Put the Minions to sleep. Wake the Demon. Show
			// the THESE ARE YOUR MINIONS info token, then point to the Minions. Put the Demon to sleep."
			const s = scenario(cast)
				.execute('poppygrower')
				.reminder('poppygrower', 'poppygrower', 'Evil Wakes');
			const ids = steps(s, 'other').map((step) => step.id);
			expect(ids).toContain('minioninfo');
			expect(ids).toContain('demoninfo');
		});
	});
});

// The optional rule on the wiki page (https://wiki.bloodontheclocktower.com/Poppy_Grower): a
// drunk or poisoned Poppy Grower no longer keeps the evil team apart.
describe('Poppy Grower optional rule', () => {
	const cast = ['poppygrower', 'chef', 'empath', 'monk', 'poisoner', 'imp'];
	const on: Command = { type: 'SetOptionalRule', characterId: 'poppygrower', on: true };
	const poisoned = (s: string[]): Command => ({
		type: 'AddReminder',
		seatId: s[0],
		reminder: { characterId: 'poisoner', label: 'Poisoned' }
	});

	it('off, a poisoned Poppy Grower still hides the Minions from the Demon', () => {
		const { game } = castGame(cast, poisoned);
		expect(demonInfo(game, characters).hiddenBy).toBe('poppygrower');
	});

	it('on, a sober Poppy Grower hides them', () => {
		const { game } = castGame(cast, on);
		expect(demonInfo(game, characters).hiddenBy).toBe('poppygrower');
	});

	it('on, a poisoned Poppy Grower hides nothing', () => {
		const { game } = castGame(cast, on, poisoned);
		expect(demonInfo(game, characters).hiddenBy).toBeUndefined();
	});
});

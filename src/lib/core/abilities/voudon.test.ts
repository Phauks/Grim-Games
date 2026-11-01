/**
 * Voudon: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Voudon
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Voudon.
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
import { livesWhileDead } from '#lib/core/rules/game-end.ts';
import { exileThreshold } from '#lib/core/rules/voting.ts';
import { registersAsDead } from '#lib/core/model/selectors.ts';
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';

describe('Voudon', () => {
	const character = committedCharacter('voudon');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition bmr', () => {
			expect(character.name).toBe('Voudon');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('bmr');
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
			expect(nightSheetPresence('voudon')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Voudon#Examples)', () => {
		it.fails('Example 1: Living Innkeeper targets Moonchild; three dead vote', () => {
			// Wiki: "There are 12 players alive, and three dead. An alive Innkeeper nominates the Moonchild.
			// Of the four players that can vote, three do. All other nominations today get fewer than three
			// votes, so the Moonchild dies."
			// A scenario holds at most 12 seats, so this one has 9 alive and three dead.
			const s = scenario([
				'voudon',
				'innkeeper',
				'moonchild',
				'imp',
				'poisoner',
				'chef',
				'empath',
				'monk',
				'soldier',
				'washerwoman',
				'librarian',
				'investigator'
			])
				.dies('washerwoman')
				.dies('librarian')
				.dies('investigator')
				.newDay()
				.nominate('innkeeper', 'moonchild');
			expect(s.game.today.entries).toHaveLength(1);
			engineGap(
				'M9',
				'with the Voudon in play only the Voudon and the dead vote, and the most votes executes with no majority needed'
			);
		});

		it('Example 2: Day-one attempt to exile the Voudon fails', () => {
			// Wiki: "It is the first day. Only the Voudon can vote, but does not. The players call for the
			// Voudon to be exiled. Five players support the exile, and seven oppose. The Voudon lives."
			const s = scenario([
				'voudon',
				'innkeeper',
				'moonchild',
				'imp',
				'poisoner',
				'chef',
				'empath',
				'monk',
				'soldier',
				'washerwoman',
				'librarian',
				'investigator'
			]).newDay();
			const needed = exileThreshold(s.game, s.characters);
			expect(needed).toBe(6);
			expect(5).toBeLessThan(needed!);
		});

		it.fails('Example 3: Dead bloc overrides earlier vote, executes Gossip', () => {
			// Wiki: "Two dead players vote for the Mastermind to be executed. Then, the Voudon, the dead Fool
			// and the apparently dead Zombuul all vote for the Gossip. The Gossip is executed."
			const s = scenario([
				'voudon',
				'mastermind',
				'gossip',
				'fool',
				'zombuul',
				'chef',
				'empath',
				'monk'
			])
				.dies('chef')
				.dies('empath')
				.dies('fool')
				.execute('zombuul')
				.newDay();
			expect(registersAsDead(s.game, s.seat('zombuul'))).toBe(true);
			expect(livesWhileDead(s.game, s.seat('zombuul'), s.characters)).toBe(true);
			engineGap(
				'M9',
				'with the Voudon in play the dead and the Voudon vote, and 3 votes beat 2 with no majority needed'
			);
		});
	});
});

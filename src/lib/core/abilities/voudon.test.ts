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
import { blockThreshold } from '#lib/core/rules/voting.ts';
import { total, voteWarnings, votes } from '#lib/core/testing/votes.ts';
import { exileThreshold } from '#lib/core/rules/voting.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

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
		it('Example 1: Living Innkeeper targets Moonchild; three dead vote', () => {
			// Wiki: "There are 12 players alive, and three dead. An alive Innkeeper nominates the Moonchild.
			// Of the four players that can vote, three do. All other nominations today get fewer than three
			// votes, so the Moonchild dies."
			const s = scenario([
				'voudon',
				'innkeeper',
				'moonchild',
				'chambermaid',
				'exorcist',
				'gossip',
				'professor',
				'minstrel',
				'tealady',
				'pacifist',
				'zombuul',
				'mastermind',
				'fool',
				'gambler',
				'courtier'
			])
				.dies('fool')
				.dies('gambler')
				.dies('courtier')
				.nominate('innkeeper', 'moonchild');
			expect(voteWarnings(s, 'voudon', 'fool', 'gambler')).toEqual([]);
			const voted = votes(s, 'voudon', 'fool', 'gambler');
			expect(total(voted)).toBe(3);
			expect(blockThreshold(voted.game, voted.characters)).toEqual({
				alive: 12,
				needed: 1,
				mostVotes: 'voudon'
			});
			// No ghost vote is spent, so the dead may vote again on the next nomination.
			expect(voted.game.seats[s.seat('fool')].ghostVoteUsed).toBe(false);
			expect(total(votes(voted.nominate('gossip', 'tealady'), 'courtier'))).toBe(1);
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

		it('Example 3: Dead bloc overrides earlier vote, executes Gossip', () => {
			// Wiki: "Two dead players vote for the Mastermind to be executed. Then, the Voudon, the dead Fool
			// and the apparently dead Zombuul all vote for the Gossip. The Gossip is executed."
			const s = scenario([
				'voudon',
				'innkeeper',
				'moonchild',
				'chambermaid',
				'exorcist',
				'gossip',
				'professor',
				'minstrel',
				'tealady',
				'pacifist',
				'zombuul',
				'mastermind',
				'fool',
				'gambler',
				'courtier'
			])
				.dies('fool')
				.dies('gambler')
				.dies('courtier')
				.reminder('zombuul', 'zombuul', 'Dead');
			const mastermind = votes(s.nominate('innkeeper', 'mastermind'), 'gambler', 'courtier');
			expect(total(mastermind)).toBe(2);
			const gossip = mastermind.nominate('moonchild', 'gossip');
			expect(voteWarnings(gossip, 'voudon', 'fool', 'zombuul')).toEqual([]);
			expect(total(votes(gossip, 'voudon', 'fool', 'zombuul'))).toBe(3);
		});
	});
});

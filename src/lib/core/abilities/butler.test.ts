/**
 * Butler: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Butler
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Butler.
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
import { latest, total, voteWarnings, votes } from '#lib/core/testing/votes.ts';
import { nightTextPlain, nightTextSegments, placeholdersFor } from '#lib/core/rules/night-text.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Butler', () => {
	const character = committedCharacter('butler');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition tb', () => {
			expect(character.name).toBe('Butler');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Master']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('butler')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Butler#Examples)', () => {
		// The Butler's vote rule (votes only while the Master votes) waits on voting in the engine.
		it('Example 1: Butler votes with master, or not at all', () => {
			// Wiki: "The Butler chooses Filip to be their Master. Tomorrow, if Filip raises his hand to
			// vote on an execution, then the Butler may too. If not, then the Butler may not raise their
			// hand."
			const s = scenario(['butler', 'chef', 'empath', 'monk', 'imp', 'poisoner'])
				.reminder('monk', 'butler', 'Master')
				.nominate('chef', 'imp');
			expect(voteWarnings(s, 'monk', 'butler')).toEqual([]);
			expect(voteWarnings(s, 'butler')).toEqual(['only-votes-with']);
		});
		it('Example 2: Master lowers hand late; Butler follows', () => {
			// Wiki: "A nomination is in progress. The Butler and their Master both have their hands raised
			// to vote. As the Storyteller is counting votes, the Master lowers their hand at the last
			// second. The Butler must lower their hand immediately."
			// The Storyteller still records the vote, with a warning.
			const s = scenario(['butler', 'chef', 'empath', 'monk', 'imp', 'poisoner'])
				.reminder('monk', 'butler', 'Master')
				.nominate('chef', 'imp');
			const recorded = votes(s, 'butler', 'empath');
			expect(latest(recorded).votes?.voters).toEqual([s.seat('butler'), s.seat('empath')]);
			expect(voteWarnings(s, 'butler', 'empath')).toEqual(['only-votes-with']);
		});
		it('Example 3: Dead Butler votes freely using their ghost vote', () => {
			// Wiki: "The Butler is dead. Because dead players have no ability, the Butler may vote with
			// their vote token at any time."
			const s = scenario(['butler', 'chef', 'empath', 'monk', 'imp', 'poisoner'])
				.reminder('monk', 'butler', 'Master')
				.dies('butler', 'imp')
				.nominate('chef', 'imp');
			expect(voteWarnings(s, 'butler')).toEqual([]);
			expect(votes(s, 'butler').game.seats[s.seat('butler')].ghostVoteUsed).toBe(true);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Butler#How_to_Run)', () => {
		it("the Butler's step each night places Master on the chosen player", () => {
			// How to Run: every night the Butler picks a player, who gets the Master reminder.
			for (const night of ['first', 'other'] as const) {
				const placeholders = placeholdersFor(character, night);
				const source =
					night === 'first' ? character.firstNightReminder : character.otherNightReminder;
				const text = nightTextPlain(
					nightTextSegments(source!, character, { ...(placeholders ? { placeholders } : {}) })
				);
				expect(text, night).toContain('[+Master]');
			}
		});

		it('allows Master on any player but the Butler, dead players included', () => {
			// How to Run: the Butler points at any player to be their Master.
			const s = scenario(['butler', 'chef', 'empath', 'monk', 'imp', 'poisoner']).dies('monk');
			const master = { characterId: 'butler', label: 'Master' };
			expect(reminderTargetMisses(s.game, master, s.seat('butler'), s.characters)).toEqual([
				'self'
			]);
			expect(reminderTargetMisses(s.game, master, s.seat('monk'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, master, s.seat('imp'), s.characters)).toEqual([]);
		});

		it('counts an illegal Butler vote in the tally', () => {
			// How to Run: if the Butler votes when they shouldn't, count the vote anyway.
			const s = scenario(['butler', 'chef', 'empath', 'monk', 'imp', 'poisoner'])
				.reminder('monk', 'butler', 'Master')
				.nominate('chef', 'imp');
			expect(total(votes(s, 'butler', 'empath'))).toBe(2);
		});
	});
});

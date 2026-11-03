/**
 * Beggar: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Beggar
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Beggar.
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
import { takesVoteTokens, tokenGiverInfo, voteHints } from '#lib/core/rules/vote-weights.ts';
import { giveVoteToken, latest, voteWarnings, votes } from '#lib/core/testing/votes.ts';
import { warned } from '#lib/core/model/fixtures.test-support.ts';
import { dayReminders, dayStateFromGame } from '#lib/core/rules/day-reminders.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

describe('Beggar', () => {
	const character = committedCharacter('beggar');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition tb', () => {
			expect(character.name).toBe('Beggar');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('tb');
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
			expect(nightSheetPresence('beggar')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Beggar#Examples)', () => {
		const BEGGAR_CAST = ['beggar', 'monk', 'recluse', 'chef', 'empath', 'imp', 'poisoner'];
		const beggarHint = (s: Scenario) =>
			voteHints(s.game, s.characters).find((h) => h.seatId === s.seat('beggar'))!;

		// Vote tokens (the Beggar votes only with tokens given to them) wait on voting in the engine.
		it('Example 1: Evil Beggar falsely calls Monk evil', () => {
			// Wiki: "The Beggar cannot vote. On the fourth day, the Monk gives her vote token to the
			// Beggar. The Beggar may now vote (once), and learns that the player is good. The Beggar is
			// evil and tells the group that the Monk player is evil."
			const s = scenario(BEGGAR_CAST).dies('monk', 'imp').nominate('chef', 'imp');
			expect(voteWarnings(s, 'beggar')).toEqual(['no-vote-token']);
			const given = s.do(giveVoteToken('monk', 'beggar'));
			expect(given.game.seats[s.seat('monk')].ghostVoteUsed).toBe(true);
			expect(beggarHint(given).needsToken?.tokens).toBe(1);
			const voted = votes(given, 'beggar');
			expect(beggarHint(voted).needsToken?.tokens).toBe(0);
			// Once used, the token is gone: on the next nomination the Beggar has none.
			const next = voted.nominate('empath', 'poisoner');
			expect(voteWarnings(next, 'beggar')).toEqual(['no-vote-token']);
		});
		it('Example 2: Beggar dies, losing all but one vote token', () => {
			// Wiki: "The good Beggar has three vote tokens. The Recluse gives the Beggar their vote token,
			// and the Beggar learns that they are evil. That day, the Beggar dies, and loses all their
			// vote tokens except for one."
			let s = scenario(BEGGAR_CAST);
			for (const dead of ['monk', 'chef', 'empath', 'recluse']) s = s.dies(dead, 'imp');
			for (const dead of ['monk', 'chef', 'empath', 'recluse'])
				s = s.do(giveVoteToken(dead, 'beggar'));
			expect(beggarHint(s).needsToken?.tokens).toBe(4);
			// The Recluse may register as evil, so the Beggar may learn evil.
			expect(
				tokenGiverInfo(s.game, s.seat('recluse'), s.seat('beggar'), s.characters)?.alignments
			).toEqual(['good', 'evil']);
			const beggarDead = s.dies('beggar', 'imp');
			expect(beggarHint(beggarDead).needsToken).toBeUndefined();
			expect(beggarHint(beggarDead).ghostVote).toBe('unused');
			// Their one vote spends their ghost vote, not a given token.
			const voted = votes(beggarDead.nominate('imp', 'poisoner'), 'beggar');
			expect(voted.game.seats[s.seat('beggar')].ghostVoteUsed).toBe(true);
			expect(latest(voted).votes?.tokens).toBeUndefined();
		});
	});
	describe('How to Run (https://wiki.bloodontheclocktower.com/Beggar#How_to_Run)', () => {
		const cast = ['beggar', 'monk', 'chef', 'empath', 'imp', 'poisoner'];
		const hint = (s: Scenario) =>
			voteHints(s.game, s.characters).find((h) => h.seatId === s.seat('beggar'))!;

		it('votes with a vote token without a warning, spending one token a vote', () => {
			// Wiki: "The Beggar cannot vote unless they have a vote token. They lose one vote token each
			// time they vote."
			const s = scenario(cast)
				.dies('monk', 'imp')
				.dies('chef', 'imp')
				.do(giveVoteToken('monk', 'beggar'), giveVoteToken('chef', 'beggar'))
				.nominate('empath', 'imp');
			expect(voteWarnings(s, 'beggar')).toEqual([]);
			const voted = votes(s, 'beggar');
			expect(latest(voted).votes?.tokens).toEqual([s.seat('beggar')]);
			expect(hint(voted).needsToken?.tokens).toBe(1);
		});

		it('reminds the Storyteller by day that the Beggar needs a vote token to vote', () => {
			// Wiki: "The Beggar cannot vote unless they have a vote token."
			const s = scenario(cast).newDay();
			const lines = dayReminders(
				dayStateFromGame(s.game, (id) => s.characters.get(id), undefined, s.characters)
			).groups.flatMap((g) => g.reminders);
			expect(lines.some((r) => r.characterId === 'beggar')).toBe(true);
		});

		it('warns when a living player gives the Beggar a vote token', () => {
			// Wiki: "During the day, a dead player can declare that they give their vote token to the
			// Beggar."
			const s = scenario(cast);
			const command = giveVoteToken('monk', 'beggar')(s);
			expect(warned(s.session, s.ctx, command)).toContain('giver-not-dead');
			const dead = s.dies('monk', 'imp');
			expect(warned(dead.session, dead.ctx, giveVoteToken('monk', 'beggar')(dead))).toEqual([]);
		});

		it('shows the Storyteller the alignment to tell the Beggar privately', () => {
			// Wiki: "Transfer the vote token to the Beggar and privately tell the Beggar the alignment
			// of that player."
			const s = scenario(cast).dies('monk', 'imp').do(giveVoteToken('monk', 'beggar'));
			expect(tokenGiverInfo(s.game, s.seat('monk'), s.seat('beggar'), s.characters)).toEqual({
				characterId: 'beggar',
				giver: s.seat('monk'),
				alignments: ['good']
			});
			// Only a player who learns it is told: a vote token given to anyone else tells nothing.
			expect(tokenGiverInfo(s.game, s.seat('monk'), s.seat('chef'), s.characters)).toBeUndefined();
		});

		it('offers vote tokens on the Beggar, a poisoned Beggar too, and on no one else', () => {
			// Wiki: "During the day, a dead player can declare that they give their vote token to the
			// Beggar."
			// The Beggar's sheet adds a token given (Trevor, 2026-11-03); a poisoned Beggar's player
			// is still handed the token, so the row stays.
			const s = scenario(cast);
			expect(takesVoteTokens(s.game, s.seat('beggar'), s.characters)).toBe(true);
			expect(takesVoteTokens(s.game, s.seat('chef'), s.characters)).toBe(false);
			const poisoned = s.poisoned('beggar');
			expect(takesVoteTokens(poisoned.game, poisoned.seat('beggar'), poisoned.characters)).toBe(
				true
			);
		});
	});
});

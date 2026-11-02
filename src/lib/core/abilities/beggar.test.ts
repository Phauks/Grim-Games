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
import { voteHints } from '#lib/core/rules/vote-weights.ts';
import { giveVoteToken, latest, voteWarnings, votes } from '#lib/core/testing/votes.ts';
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
			const beggarDead = s.dies('beggar', 'imp');
			expect(beggarHint(beggarDead).needsToken).toBeUndefined();
			expect(beggarHint(beggarDead).ghostVote).toBe('unused');
			// Their one vote spends their ghost vote, not a given token.
			const voted = votes(beggarDead.nominate('imp', 'poisoner'), 'beggar');
			expect(voted.game.seats[s.seat('beggar')].ghostVoteUsed).toBe(true);
			expect(latest(voted).votes?.tokens).toBeUndefined();
		});
	});
});

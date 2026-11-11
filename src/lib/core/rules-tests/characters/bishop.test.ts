/**
 * Bishop: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Bishop
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Bishop.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { alignmentOf } from '#lib/core/model/selectors.ts';
import { abilityState } from '#lib/core/rules/abilities/ability.ts';
import { mayNominate, storytellerNominates } from '#lib/core/rules/day/nominations.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { warned } from '#lib/core/model/fixtures.test-support.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';

describe('Bishop', () => {
	const character = committedCharacter('bishop');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition bmr', () => {
			expect(character.name).toBe('Bishop');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Nominate Good', 'Nominate Evil']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('bishop')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Bishop#Examples)', () => {
		const table = (alignment: 'good' | 'evil') =>
			scenario(['bishop', 'minstrel', 'chef', 'empath', 'goon', 'poisoner', 'imp']).do((s) => ({
				type: 'SetAlignment',
				seatId: s.seat('bishop'),
				alignment
			}));

		it('Example 1: Good Bishop: day-one nominees include Demon and Minion', () => {
			// Wiki: "The Bishop is good. On the first day, the Storyteller nominates the Demon, a
			// Minion, and two Townsfolk. On the second day, the Storyteller nominates a Minion and
			// Outsider."
			// Only the Storyteller nominates, and each day at least one opposing (evil) player.
			const s = table('good').newDay();
			expect(alignmentOf(s.game, s.seat('bishop'))).toBe('good');
			expect(abilityState(s.game, s.seat('bishop'), s.characters).works).toBe(true);
			expect(storytellerNominates(s.game, s.characters)).toEqual(['bishop']);
			// Whom the Storyteller nominates, and that one is evil, is theirs to pick: the app keeps
			// no list of who must be nominated.
		});
		it('Example 2: Evil Bishop: a good Minstrel gets nominated', () => {
			// Wiki: "The Bishop is evil. The Storyteller has nominated nobody. However, the
			// Storyteller must nominate at least one good player today, so they choose the Minstrel.
			// The next day, the Storyteller nominates four good players and the Demon. The Bishop is
			// exiled that day, and now the players may continue the nomination process normally."
			// Once the Bishop is exiled, players nominate again.
			const s = table('evil').newDay();
			expect(alignmentOf(s.game, s.seat('bishop'))).toBe('evil');
			expect(storytellerNominates(s.game, s.characters)).toEqual(['bishop']);
			const exiled = s.newDay().do((at) => ({ type: 'Exile', seatId: at.seat('bishop') }));
			expect(exiled.game.seats[exiled.seat('bishop')].dead).toBe(true);
			expect(mayNominate(exiled.game, exiled.seat('chef'), exiled.characters)).toBe(true);
			expect(storytellerNominates(exiled.game, exiled.characters)).toEqual([]);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Bishop#How_to_Run)', () => {
		const cast = ['bishop', 'minstrel', 'chef', 'empath', 'goon', 'poisoner', 'imp'];
		const withBishop = (alignment: 'good' | 'evil') =>
			scenario(cast).do((s) => ({ type: 'SetAlignment', seatId: s.seat('bishop'), alignment }));

		it('puts Nominate Evil on a good Bishop and Nominate Good on an evil Bishop', () => {
			// Wiki: "Each dawn, mark the good Bishop with their NOMINATE EVIL reminder, or mark the evil
			// Bishop with their NOMINATE GOOD reminder."
			const evil = { characterId: 'bishop', label: 'Nominate Evil' };
			const good = { characterId: 'bishop', label: 'Nominate Good' };
			const g = withBishop('good');
			expect(reminderTargetMisses(g.game, evil, g.seat('bishop'), g.characters)).toEqual([]);
			expect(reminderTargetMisses(g.game, good, g.seat('bishop'), g.characters)).toEqual([
				'alignment'
			]);
			const e = withBishop('evil');
			expect(reminderTargetMisses(e.game, good, e.seat('bishop'), e.characters)).toEqual([]);
			expect(reminderTargetMisses(e.game, evil, e.seat('bishop'), e.characters)).toEqual([
				'alignment'
			]);
		});

		it('has the Storyteller nominate, and logs their nominations as usual', () => {
			// Wiki: "During the nomination process for execution, the players cannot make
			// nominations, but you can. (Voting happens as normal.)"
			const s = withBishop('good').newDay();
			expect(storytellerNominates(s.game, s.characters)).toEqual(['bishop']);
			const nominated = s.nominate('chef', 'imp');
			expect(nominated.game.today.entries.filter((e) => e.kind === 'nomination')).toHaveLength(1);
			expect(storytellerNominates(nominated.game, nominated.characters)).toEqual(['bishop']);
		});

		it("removes the Bishop's reminder once a player of the other alignment is nominated", () => {
			// Wiki: "When you nominate a player whose alignment is opposite the alignment of the
			// Bishop, remove the Bishop’s reminder. You cannot end the nomination process if the
			// Bishop is marked with their reminder."
			const s = withBishop('good').newDay().reminder('bishop', 'bishop', 'Nominate Evil');
			const labels = (at: typeof s) =>
				at.game.seats[at.seat('bishop')].reminders.map((r) => r.label);
			// A good nominee leaves it on, and ending the day warns.
			const good = s.nominate('chef', 'empath');
			expect(labels(good)).toEqual(['Nominate Evil']);
			expect(warned(good.session, good.ctx, { type: 'Dusk' })).toContain('nominations-unfinished');
			// An evil nominee takes it off, and the day may end.
			const evil = good.nominate('minstrel', 'imp');
			expect(labels(evil)).toEqual([]);
			expect(warned(evil.session, evil.ctx, { type: 'Dusk' })).not.toContain(
				'nominations-unfinished'
			);
		});
	});
});

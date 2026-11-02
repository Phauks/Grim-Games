/**
 * Gunslinger: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Gunslinger
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Gunslinger.
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
import { dayUseDeath } from '#lib/core/rules/day-claims.ts';
import { todaysNominations } from '#lib/core/rules/nominations.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { dayReminders, dayStateFromGame } from '#lib/core/rules/day-reminders.ts';
import { validDeathCauses } from '#lib/core/rules/death-causes.ts';
import { latest, votes } from '#lib/core/testing/votes.ts';

describe('Gunslinger', () => {
	const character = committedCharacter('gunslinger');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition tb', () => {
			expect(character.name).toBe('Gunslinger');
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
			expect(nightSheetPresence('gunslinger')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Gunslinger#Examples)', () => {
		it("Example 1: Voter shot; Imp's execution still proceeds", () => {
			// Wiki: "The Imp has been nominated. There are 10 players alive, and five votes for the Imp,
			// so the Imp is about to die. The Gunslinger chooses a voting player to die. They die, and the
			// nomination continues, with the Imp still about to die."
			// Votes are counted outside the app (Trevor, 2026-11-01): who voted, and who is about to
			// die, are the Storyteller's. The app kills the voter and keeps the nomination going.
			const s = scenario(['gunslinger', 'chef', 'imp', 'monk', 'poisoner'])
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('gunslinger'), alignment: 'good' }))
				.nominate('chef', 'imp');
			expect(dayUseDeath(s.game, 'gunslinger', s.seat('monk'), s.characters)).toBe('dies');
			const shot = s.dies('monk', 'gunslinger');
			expect(shot.game.seats[shot.seat('monk')].deathCause).toBe('gunslinger');
			// The Imp is still executed by that nomination.
			const executed = shot.execute('imp');
			expect(executed.game.seats[executed.seat('imp')].dead).toBe(true);
		});
		it("Example 2: Only the day's first vote tally counts", () => {
			// Wiki: "The players exile the Thief. Then, the Butler is nominated for execution and gets one
			// vote. This is the first nomination for execution, since the Thief’s exile does not count.
			// The Gunslinger chooses to kill the single voting player. Later that day, the Saint is
			// nominated and six players vote. The Gunslinger cannot use their ability now because this is
			// not the first vote for execution today."
			// An exile doesn't count as the first vote for execution: the Butler's nomination is the
			// day's first. Which vote the Gunslinger may act on is the Storyteller's to judge.
			const s = scenario(['gunslinger', 'thief', 'butler', 'saint', 'imp', 'chef'])
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('thief'), alignment: 'good' }))
				.do((at) => ({ type: 'Exile', seatId: at.seat('thief') }))
				.nominate('chef', 'butler');
			expect(todaysNominations(s.game).map((n) => n.nominee)).toEqual([s.seat('butler')]);
		});
	});
	describe('How to Run (https://wiki.bloodontheclocktower.com/Gunslinger#How_to_Run)', () => {
		const cast = ['gunslinger', 'chef', 'imp', 'monk', 'poisoner', 'empath'];
		const table = () =>
			scenario(cast).do((at) => ({
				type: 'SetAlignment',
				seatId: at.seat('gunslinger'),
				alignment: 'good'
			}));

		it('reminds the Storyteller by day that the Gunslinger may shoot a voter', () => {
			// Wiki: "If the Gunslinger is a new player, you may wish to remind them that they can use
			// their ability."
			const s = table().newDay();
			const lines = dayReminders(
				dayStateFromGame(s.game, (id) => s.characters.get(id), undefined, s.characters)
			).groups.flatMap((g) => g.reminders);
			expect(lines.some((r) => r.characterId === 'gunslinger')).toBe(true);
		});

		it('kills the chosen voter by day, but not a voter who is already dead', () => {
			// Wiki: "If so, the Gunslinger points at any player who voted for this execution. The
			// chosen player dies."
			const s = table().dies('empath', 'imp').nominate('chef', 'imp');
			const voted = votes(s, 'monk', 'empath');
			const causes = validDeathCauses(voted.game, voted.seat('monk'), voted.characters, {
				day: true
			});
			expect(causes).toContainEqual(expect.objectContaining({ cause: 'gunslinger', flags: [] }));
			expect(dayUseDeath(voted.game, 'gunslinger', voted.seat('monk'), voted.characters)).toBe(
				'dies'
			);
			expect(dayUseDeath(voted.game, 'gunslinger', voted.seat('empath'), voted.characters)).toBe(
				'no'
			);
		});

		it('keeps who voted on the nomination, so the Storyteller can check the choice', () => {
			// Wiki: "When the Gunslinger wants to use their ability, you may need to ask all players who
			// voted to raise their hand again, so the Gunslinger doesn’t accidentally choose a player
			// that didn’t vote."
			const s = votes(table().nominate('chef', 'imp'), 'monk', 'poisoner');
			expect(latest(s).votes?.voters).toEqual([s.seat('monk'), s.seat('poisoner')]);
		});
	});
});

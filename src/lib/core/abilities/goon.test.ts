/**
 * Goon: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Goon
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Goon.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { becomesOffer } from '#lib/core/rules/becomes.ts';
import { infoPicker, isAllowed } from '#lib/core/rules/night-info/picker.ts';
import { preventedDeaths } from '#lib/core/rules/prevented-deaths.ts';
import { scenario, type Scenario, type SeatRef } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Goon', () => {
	const character = committedCharacter('goon');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition bmr', () => {
			expect(character.name).toBe('Goon');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Drunk']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('goon')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Goon#Examples)', () => {
		/** What the Goon's Drunk on `chooser` offers: the Goon takes the chooser's alignment. */
		const offer = (s: Scenario, chooser: SeatRef) =>
			becomesOffer(s.game, s.seat(chooser), { characterId: 'goon', label: 'Drunk' }, s.characters);
		const evil = (s: Scenario, on: SeatRef) =>
			s.do({ type: 'SetAlignment', seatId: s.seat(on), alignment: 'evil' });

		it("Example 1: Courtier's pick turns Goon good", () => {
			// Wiki: "The Courtier chooses the Goon. The Goon turns good, and the Courtier becomes
			// drunk."
			const s = evil(scenario(['courtier', 'goon', 'chef', 'empath', 'imp']), 'goon').reminder(
				'courtier',
				'goon',
				'Drunk'
			);
			expect(offer(s, 'courtier')).toEqual({
				into: 'alignment',
				seatId: s.seat('goon'),
				characterId: 'goon',
				alignment: 'good'
			});
			expect(abilityState(s.game, s.seat('courtier'), s.characters).impairments).toMatchObject([
				{ reason: 'drunk', source: { characterId: 'goon' } }
			]);
		});
		it("Example 2: Demon's kills fizzle while Goon turns evil", () => {
			// Wiki: "The Shabaloth attacks the Goon, then the Gossip. Since the Shabaloth became drunk
			// as soon as they chose the Goon, neither player dies tonight, and the Goon turns evil. The
			// next night, the Shabaloth attacks the Gambler then the Goon. The Gambler dies, then the
			// Shabaloth becomes drunk again. The Goon is still alive and still evil."
			const cast = ['goon', 'gossip', 'gambler', 'chef', 'shabaloth'];
			const night1 = scenario(cast)
				.newDay()
				.reminder('shabaloth', 'goon', 'Drunk')
				.reminder('goon', 'shabaloth', 'Dead')
				.reminder('gossip', 'shabaloth', 'Dead');
			const survivors = preventedDeaths(night1.game, night1.characters);
			expect(survivors.map((p) => p.seatId)).toEqual([night1.seat('goon'), night1.seat('gossip')]);
			for (const p of survivors) expect(p.because.map((b) => b.kind)).toEqual(['killer-impaired']);
			expect(offer(night1, 'shabaloth')).toMatchObject({
				seatId: night1.seat('goon'),
				alignment: 'evil'
			});

			// Dusk ends the drunkenness; the next night the Gambler dies before the Goon is chosen.
			const tokens = night1.game.seating.flatMap((id) => night1.game.seats[id].reminders);
			const night2 = tokens
				.reduce<Scenario>(
					(at, r) => at.do({ type: 'RemoveReminder', reminderId: r.reminderId }),
					evil(night1, 'goon')
				)
				.newDay()
				.dies('gambler', 'shabaloth')
				.reminder('shabaloth', 'goon', 'Drunk')
				.reminder('goon', 'shabaloth', 'Dead');
			expect(night2.game.seats[night2.seat('gambler')].dead).toBe(true);
			expect(preventedDeaths(night2.game, night2.characters)).toMatchObject([
				{ seatId: night2.seat('goon'), because: [{ kind: 'killer-impaired' }] }
			]);
			// Already evil: nothing to change.
			expect(offer(night2, 'shabaloth')).toBeUndefined();
		});
		it('Example 3: Drunk Chambermaid gets misleading count', () => {
			// Wiki: "The Chambermaid chooses the Goon and the Minstrel, and learns a "1" because the
			// Chambermaid is drunk."
			const s = scenario(['chambermaid', 'goon', 'minstrel', 'chef', 'imp'])
				.newDay()
				.reminder('chambermaid', 'goon', 'Drunk');
			const picker = infoPicker(
				s.game,
				s.seat('chambermaid'),
				'chambermaid',
				s.characters,
				'other'
			)!;
			const pair = [s.seat('goon'), s.seat('minstrel')];
			const truth = picker.options.find(
				(o) => o.seats.length === 2 && pair.every((id) => o.seats.includes(id))
			)?.number;
			expect(truth).toBe(0);
			expect(picker.anyAllowed).toBe(true);
			expect(isAllowed(picker, { seats: pair, number: 1 })).toBe(true);
		});
		it("Example 4: Tea Lady's neighbour Tinker survives one execution", () => {
			// Wiki: "The Tea Lady neighbours the good Goon and the Tinker. The Tinker is executed, but
			// does not die. The next day, the Goon is evil. The Tinker is executed again and dies."
			const s = scenario(['goon', 'tealady', 'tinker', 'chef', 'imp'])
				.reminder('goon', 'tealady', 'Cannot Die')
				.reminder('tinker', 'tealady', 'Cannot Die')
				.newDay()
				.execute('tinker');
			expect(s.game.seats[s.seat('tinker')].dead).toBe(false);
			const again = evil(s, 'goon').newDay().execute('tinker');
			expect(again.game.seats[again.seat('tinker')]).toMatchObject({
				dead: true,
				deathCause: 'execution'
			});
		});
	});
});

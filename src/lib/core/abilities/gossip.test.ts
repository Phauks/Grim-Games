/**
 * Gossip: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Gossip
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Gossip.
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
import { nightAnswer } from '#lib/core/rules/night-info.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Gossip', () => {
	const character = committedCharacter('gossip');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition bmr', () => {
			expect(character.name).toBe('Gossip');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('gossip')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Gossip#Examples)', () => {
		/** The Gossip's public statement today, marked true or false. */
		const says = (s: Scenario, text: string, holds: boolean) =>
			s.do((at) => ({
				type: 'DayNote',
				characterId: 'gossip',
				seatId: at.seat('gossip'),
				text,
				holds
			}));
		const answer = (s: Scenario) =>
			nightAnswer(s.game, s.seat('gossip'), 'gossip', s.characters, undefined, 'other');

		it("Example 1: Gossip's false statement about the Demon", () => {
			// Wiki: "During the day, the Gossip says, "I am the Gossip. My public statement is: The
			// Demon is wearing a hat." The Demon is not wearing a hat. That night, nobody dies due to
			// the Gossip’s ability."
			const s = says(
				scenario(['gossip', 'chef', 'empath', 'monk', 'imp']).newDay(),
				'The Demon is wearing a hat.',
				false
			);
			expect(answer(s)).toMatchObject({ kind: 'yes-no', value: false });
		});
		it("Example 2: Sober Gossip's true statement kills Chambermaid", () => {
			// Wiki: "The Gossip neighbours a good Traveller and the Pacifist. During the day, the
			// drunk Gossip says, "Both my neighbours are good." At dusk, the drunk Gossip becomes
			// sober. That night, the Chambermaid dies."
			// The Gossip is drunk by day (here the Goon's Drunk, which lasts until dusk).
			const day = says(
				scenario(['gunslinger', 'gossip', 'pacifist', 'chambermaid', 'goon', 'imp'])
					.becomes('gunslinger', 'gunslinger', 'good')
					.newDay()
					.reminder('gossip', 'goon', 'Drunk'),
				'Both my neighbours are good.',
				true
			);
			expect(abilityState(day.game, day.seat('gossip'), day.characters).works).toBe(false);
			const drunk = day.game.seats[day.seat('gossip')].reminders[0];
			const night = day.do({ type: 'RemoveReminder', reminderId: drunk.reminderId });
			const a = answer(night);
			expect(a).toMatchObject({ kind: 'yes-no', value: true });
			expect(a?.unreliable).toBeUndefined();
			const killed = night.dies('chambermaid', 'gossip');
			expect(killed.game.seats[killed.seat('chambermaid')]).toMatchObject({
				dead: true,
				deathCause: 'gossip'
			});
		});
		it("Example 3: Killed Gossip's true statement causes no death", () => {
			// Wiki: "During the day, the Gossip makes a true statement. That night, the Gossip is
			// killed by the Demon. They lose their ability, so their statement does not kill anyone
			// tonight."
			const s = says(
				scenario(['gossip', 'chef', 'empath', 'monk', 'imp']).newDay(),
				'The Chef is good.',
				true
			);
			expect(answer(s)).toMatchObject({ kind: 'yes-no', value: true });
			const killed = s.dies('gossip', 'imp');
			expect(abilityState(killed.game, killed.seat('gossip'), killed.characters)).toMatchObject({
				works: false,
				dead: true
			});
		});
	});
});

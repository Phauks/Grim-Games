/**
 * Gambler: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Gambler
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Gambler.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { nightStepAlerts } from '#lib/core/rules/night/night-alerts.ts';
import { deathCheck, deathVerdict } from '#lib/core/rules/night/night-deaths.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { validDeathCauses } from '#lib/core/rules/abilities/death-causes.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';

describe('Gambler', () => {
	const character = committedCharacter('gambler');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition bmr', () => {
			expect(character.name).toBe('Gambler');
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
			expect(nightSheetPresence('gambler')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Gambler#Examples)', () => {
		it('Example 1: Right Minstrel guess, but Demon kills them', () => {
			// Wiki: "The Gambler points to the Minstrel player, then to the Minstrel icon. This guess is
			// correct, so the Gambler remains alive, but is killed by the Demon tonight anyway."
			const s = scenario(['gambler', 'minstrel', 'chef', 'empath', 'imp']).newDay();
			expect(
				deathVerdict(
					s.game,
					s.seat('gambler'),
					'gambler',
					{ seatId: s.seat('minstrel'), characterId: 'minstrel' },
					s.characters
				)
			).toMatchObject({ kind: 'no-death', because: 'right-guess' });
			// A right guess protects nobody from the Demon.
			const gambler = nightStepAlerts(s.game, 'imp', s.characters).filter(
				(a) => a.seatId === s.seat('gambler')
			);
			expect(gambler.map((a) => a.kind)).not.toContain('protected');
			const killed = s.dies('gambler', 'imp');
			expect(killed.game.seats[killed.seat('gambler')]).toMatchObject({
				dead: true,
				deathCause: 'imp'
			});
		});
		it("Example 2: Wrong Pacifist guess on Devil's Advocate; Gambler dies", () => {
			// Wiki: "The Devil's Advocate is bluffing as the Pacifist. That night, the Gambler points to
			// the Devil's Advocate player, then to the Pacifist icon. This guess is wrong, so the
			// Gambler dies."
			const s = scenario(['gambler', 'devilsadvocate', 'chef', 'empath', 'imp']).newDay();
			expect(
				deathVerdict(
					s.game,
					s.seat('gambler'),
					'gambler',
					{ seatId: s.seat('devilsadvocate'), characterId: 'pacifist' },
					s.characters
				)
			).toMatchObject({ kind: 'dies', seatIds: [s.seat('gambler')], because: 'wrong-guess' });
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Gambler#How_to_Run)', () => {
		const cast = ['gambler', 'minstrel', 'chef', 'empath', 'imp'];

		it('asks for a player and a character each night but the first', () => {
			// Wiki: "Each night except the first, wake the Gambler. They point at any player, then
			// point at any character icon on their character sheet. Put the Gambler to sleep."
			const s = scenario(cast).newDay();
			expect(deathCheck(s.game, s.seat('gambler'), 'gambler', s.characters)).toMatchObject({
				needs: 'player-character'
			});
			expect(
				deathVerdict(s.game, s.seat('gambler'), 'gambler', { seatId: s.seat('chef') }, s.characters)
			).toEqual({ kind: 'choose', missing: 'character' });
		});

		it('marks only the Gambler Dead, and offers the Gambler as a cause only for themself', () => {
			// Wiki: "If the chosen player is a different character from the chosen character icon, the
			// Gambler dies—mark them with the DEAD reminder."
			const s = scenario(cast).newDay();
			const dead = { characterId: 'gambler', label: 'Dead' };
			expect(reminderTargetMisses(s.game, dead, s.seat('gambler'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, dead, s.seat('chef'), s.characters)).not.toEqual([]);
			const causes = (seat: 'gambler' | 'chef') =>
				validDeathCauses(s.game, s.seat(seat), s.characters).map((c) => c.cause);
			expect(causes('gambler')).toContain('gambler');
			expect(causes('chef')).not.toContain('gambler');
		});
	});
});

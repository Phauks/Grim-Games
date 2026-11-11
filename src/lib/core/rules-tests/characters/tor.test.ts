/**
 * Tor: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Tor
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Tor.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import {
	committedCharacter,
	committedNightOrder,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';
import { dayUseDeath } from '#lib/core/rules/day-claims.ts';
import { setupModifierFor } from '#lib/core/rules/setup-modifiers.ts';
import { evilTeamInfoRemovedBy } from '#lib/core/rules/teensyville.ts';
import { stepInfoCards } from '#lib/core/rules/info-token-characters.ts';
import { seatRoles } from '#lib/core/sync/seat-roles.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Tor', () => {
	const character = committedCharacter('tor');

	describe('data (roles.json)', () => {
		it('is a Loric from edition loric', () => {
			expect(character.name).toBe('Tor');
			expect(character.type).toBe('loric');
			expect(character.edition).toBe('loric');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('tor')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Tor#Examples)', () => {
		it('Example 1: Hidden characters revealed after execution and death', () => {
			// Wiki: "Julian, Alex, Evin, Lachlan, Sarah, Marianna and Amy do not know which
			// character they are. Evin wakes each night and learns a thumbs up, but does not know
			// why. Sarah wakes each night to choose a player, but does not know why. Amy wakes each
			// night to choose a player, but does not know why. Sarah is executed and learns that
			// she is the good Monk. Lachlan, guessing that he might be the Slayer, publicly says
			// that he is the Slayer, and chooses Amy. Amy dies. Evin was the General, Lachlan was
			// the Slayer and Amy was the Imp."
			// Seven players, in the order named; the Minion and Demon info are left out, and the
			// guessing Slayer's shot still kills the Imp.
			const cast = ['chef', 'empath', 'general', 'slayer', 'monk', 'poisoner', 'imp'];
			const s = scenario(cast).rule('tor');
			const tor = s.characters.get('tor')!;
			expect(setupModifierFor(tor)?.notes).toEqual([
				'Players do not see their character or alignment until they die.'
			]);
			const inPlay = [...cast.map((id) => s.characters.get(id)!), tor];
			expect(evilTeamInfoRemovedBy(inPlay)?.id).toBe('tor');
			const executed = s.execute('monk');
			expect(executed.game.seats[executed.seat('monk')]).toMatchObject({
				dead: true,
				deathCause: 'execution'
			});
			const day = executed.newDay();
			expect(dayUseDeath(day.game, 'slayer', day.seat('imp'), day.characters)).toBe('dies');
			const shot = day.dies('imp', 'slayer');
			expect(shot.game.seats[shot.seat('imp')].deathCause).toBe('slayer');
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Tor#How_to_Run)', () => {
		it('shows living players no character, since no one draws from the bag', () => {
			// Wiki: "During setup, do not pass the bag to the players. Instead, draw the character
			// tokens from the bag and place them in order in the Grimoire."
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp']);
			expect(Object.keys(seatRoles(s.game, s.characters))).toHaveLength(5);
			const hidden = s.rule('tor');
			expect(seatRoles(hidden.game, hidden.characters)).toEqual({});
		});

		it('tells a player who dies what character they are', () => {
			// Wiki: "If a player dies during the day, privately tell them what character and
			// alignment they are."
			const s = scenario(['chef', 'empath', 'monk', 'poisoner', 'imp']).rule('tor').execute('monk');
			expect(seatRoles(s.game, s.characters)).toEqual({
				[s.seat('monk')]: { characterId: 'monk' }
			});
		});

		it('wakes on other nights to show a player who died their character with You are', () => {
			// Wiki: "If a player dies at night, wake them, show them the YOU ARE info token, their
			// character token, the YOU ARE info token, and either a thumbs up or a thumbs down."
			expect(committedNightOrder('otherNight')).toContain('tor');
			expect(stepInfoCards(character, character.otherNightReminder)).toMatchObject([
				{ token: { id: 'you-are' }, filled: { upTo: 1 } }
			]);
		});
	});
});

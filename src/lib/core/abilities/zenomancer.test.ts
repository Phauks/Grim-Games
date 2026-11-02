/**
 * Zenomancer: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Zenomancer
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Zenomancer.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { takesNote } from '#lib/core/rules/shown-to.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

const characters = committedGameData().byId;

describe('Zenomancer', () => {
	const character = committedCharacter('zenomancer');

	describe('data (roles.json)', () => {
		it('is a Loric from edition loric', () => {
			expect(character.name).toBe('Zenomancer');
			expect(character.type).toBe('loric');
			expect(character.edition).toBe('loric');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Goal', 'Goal', 'Goal']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('zenomancer')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	// Summary: the Storyteller sets each goal and the true info it earns, so the app keeps the
	// goal they typed on that player's Goal reminder and shows it on a "Your goal is" card
	// (Trevor, 2026-10-31).
	describe('goals', () => {
		it('each Goal reminder carries the Storyteller’s words; other reminders don’t', () => {
			expect(takesNote({ characterId: 'zenomancer', label: 'Goal' }, characters)).toBe(true);
			expect(takesNote({ characterId: 'zenomancer', label: 'Other' }, characters)).toBe(false);
			expect(takesNote({ characterId: 'chef', label: 'Goal' }, characters)).toBe(false);
		});

		it('shows the goal on its own card', () => {
			expect(rulesOf('zenomancer', characters)?.infoCard).toBe('goal');
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Zenomancer#Examples)', () => {
		// Whether a goal was met, and the true information it earns, are the Storyteller's to
		// judge: the app keeps each goal on that player's Goal reminder.
		const goal = (s: ReturnType<typeof scenario>, seat: string, text: string) =>
			s.reminder(seat, 'zenomancer', 'Goal').do((at) => ({
				type: 'SetReminderNote',
				reminderId: at.game.seats[at.seat(seat)].reminders.findLast(
					(r) => r.characterId === 'zenomancer'
				)!.reminderId,
				note: text
			}));
		const goalOf = (s: ReturnType<typeof scenario>, seat: string) =>
			s.game.seats[s.seat(seat)].reminders.find(
				(r) => r.characterId === 'zenomancer' && takesNote(r, s.characters)
			)?.note;

		it('Example 1: Pit-Hag converts Witch, learns drunk Sage', () => {
			// Wiki: "Alex is the Pit-Hag. He is given the goal “create an evil Outsider”. Alex
			// turns the Witch into the Sweetheart, and learns that Lewis is the drunk Sage."
			const s = goal(
				scenario(['pithag', 'witch', 'sage', 'chef', 'imp']).rule('zenomancer').drunk('sage'),
				'pithag',
				'create an evil Outsider'
			);
			expect(goalOf(s, 'pithag')).toBe('create an evil Outsider');
			const after = s.becomes('witch', 'sweetheart', 'evil');
			expect(after.game.seats[after.seat('witch')]).toMatchObject({
				characterId: 'sweetheart',
				alignment: 'evil'
			});
			expect(abilityState(after.game, after.seat('sage'), after.characters).works).toBe(false);
		});
		it('Example 2: Marionette doubt goal works; another goal fails', () => {
			// Wiki: "Evin is given the goal “convince Sarah that she is the Marionette”. The
			// Storyteller judges that Sarah is adequately confused about whether she is the
			// Marionette or not. Evin learns that there is no Marionette in play. Meanwhile, Ben
			// has the goal “nominate and execute a Minion”. This does not happen, and Ben does not
			// get his Zenomancer information."
			const cast = ['chef', 'empath', 'monk', 'soldier', 'poisoner', 'imp'];
			const base = scenario(cast).rule('zenomancer');
			const s = goal(
				goal(base, 'chef', 'convince Sarah that she is the Marionette'),
				'empath',
				'nominate and execute a Minion'
			);
			expect(goalOf(s, 'chef')).toBe('convince Sarah that she is the Marionette');
			expect(goalOf(s, 'empath')).toBe('nominate and execute a Minion');
			expect(s.game.seating.some((id) => s.game.seats[id].characterId === 'marionette')).toBe(
				false
			);
		});
		it('Example 3: Pillow theft reveals the Demon', () => {
			// Wiki: "Julian has the goal to “steal all the comfy pillows from the couch, without
			// touching them”. Amy has the same goal. Amy convinces Marianna to engage Julian in a
			// private chat while Abdallah steals the pillows and gives them to her. Amy learns that
			// the Demon is a Fang Gu."
			const text = 'steal all the comfy pillows from the couch, without touching them';
			const cast = ['chef', 'empath', 'monk', 'soldier', 'poisoner', 'fanggu'];
			const s = goal(goal(scenario(cast).rule('zenomancer'), 'chef', text), 'empath', text);
			expect([goalOf(s, 'chef'), goalOf(s, 'empath')]).toEqual([text, text]);
			expect(s.characters.get(s.game.seats[s.seat('fanggu')].characterId!)?.type).toBe('demon');
		});
	});
});

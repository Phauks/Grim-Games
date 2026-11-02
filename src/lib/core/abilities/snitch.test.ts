/**
 * Snitch: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Snitch
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Snitch.
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
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';
import { nightOrder, type Night } from '#lib/core/rules/night-order.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

/** The notes the night order gives at each step tonight, by step id. */
const notesTonight = (s: Scenario, night: Night) =>
	nightOrder({
		night,
		sheet: committedGameData().nightSheet,
		players: s.game.seating.length,
		inPlay: s.game.seating.map((id) => s.characters.get(s.game.seats[id].characterId!)!)
	}).steps.map((step) => ({ id: step.id, notes: step.notes.join(' ') }));

describe('Snitch', () => {
	const character = committedCharacter('snitch');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition carousel', () => {
			expect(character.name).toBe('Snitch');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('snitch')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Snitch#Examples)', () => {
		it('Example 1: All evil players get three not-in-play characters', () => {
			// Wiki: "On the first night, the Demon and its two Minions all learn that the Sage,
			// Innkeeper, and Golem are not in play."
			const s = scenario([
				'snitch',
				'chef',
				'empath',
				'cerenovus',
				'pithag',
				'monk',
				'vigormortis'
			]).do({ type: 'SetBluffs', set: 0, characterIds: ['sage', 'innkeeper', 'golem'] });
			const demonInfo = notesTonight(s, 'first').find((step) => step.id === 'demoninfo');
			expect(demonInfo?.notes).toMatch(/Snitch/);
			expect(s.game.bluffs).toEqual([['sage', 'innkeeper', 'golem']]);
		});
		it('Example 2: Demon and Mastermind bluffs match; the rest differ', () => {
			// Wiki: "On the first night, the Demon learns that the Fool, Monk, and Saint are not in
			// play. The Mastermind learns that the Fool, Monk, and Saint are not in play. The Witch
			// learns that the Fool, Flowergirl, and Barber are not in play. The Fearmonger learns that
			// the Noble, Amnesiac, and Heretic are not in play."
			// One bluff set for each player who gets bluffs.
			const sets = [
				['fool', 'monk', 'saint'],
				['fool', 'monk', 'saint'],
				['fool', 'flowergirl', 'barber'],
				['noble', 'amnesiac', 'heretic']
			];
			const s = scenario([
				'snitch',
				'chef',
				'mastermind',
				'empath',
				'witch',
				'chambermaid',
				'fearmonger',
				'mayor',
				'nodashii',
				'clockmaker'
			]).do(
				...sets.map((characterIds, set) => ({ type: 'SetBluffs' as const, set, characterIds }))
			);
			const demonInfo = notesTonight(s, 'first').find((step) => step.id === 'demoninfo');
			expect(demonInfo?.notes).toMatch(/Snitch/);
			expect(s.game.bluffs).toEqual(sets);
		});
		it.fails('Example 3: Pit-Hag creates Snitch; Minions each get three', () => {
			// Wiki: "On the fourth night, the Pit-Hag creates a Snitch. All Minions learn three
			// not-in-play characters."
			const s = scenario(['chef', 'empath', 'pithag', 'monk', 'witch', 'imp', 'mayor'])
				.newDay()
				.newDay()
				.newDay()
				.becomes('chef', 'snitch');
			// Waits on the engine (M15k): a Snitch made after the first night adds no step or note that
			// night telling the Storyteller to show each Minion three bluffs.
			const notes = notesTonight(s, 'other')
				.map((step) => step.notes)
				.join(' ');
			expect(notes).toMatch(/Snitch/);
		});
	});
});

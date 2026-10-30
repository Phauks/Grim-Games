/**
 * Lord of Typhon: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Lord_of_Typhon
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Lord of Typhon.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { evilInOneLine, nightStepAlerts } from '#lib/core/rules/night-alerts.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

/** The Lord of Typhon's seating alerts, by seat number. */
const seating = (cast: string[]) => {
	const { game, seats } = castGame(cast);
	return nightStepAlerts(game, 'lordoftyphon', characters)
		.filter((a) => a.kind === 'seating')
		.map((a) => seats.indexOf(a.seatId) + 1);
};

describe('Lord of Typhon', () => {
	const character = committedCharacter('lordoftyphon');

	describe('data (roles.json)', () => {
		it('is a Demon from edition carousel', () => {
			expect(character.name).toBe('Lord of Typhon');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('lordoftyphon')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	// How to Run: the evil players sit in one line, the Lord of Typhon inside it with a Minion on
	// each side. The app warns on its night step when they don't; it never moves anyone.
	describe('seating', () => {
		it('warns when the Lord of Typhon sits at the end of the evil line', () => {
			expect(seating(['lordoftyphon', 'poisoner', 'spy', 'empath', 'monk'])).toEqual([1]);
		});

		it('warns when an evil player sits apart from the line', () => {
			expect(
				seating(['poisoner', 'lordoftyphon', 'spy', 'empath', 'monk', 'baron', 'chef'])
			).toEqual([2]);
		});

		it('counts the line round the table', () => {
			const { game, seats } = castGame(['lordoftyphon', 'spy', 'empath', 'monk', 'poisoner']);
			expect(evilInOneLine(game, seats[0])).toBe(true);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Lord_of_Typhon#Examples)', () => {
		// Two Minions sit either side of the Lord of Typhon: nothing to warn about.
		it('Example 1: two Minions flank the Lord of Typhon', () => {
			expect(seating(['empath', 'poisoner', 'lordoftyphon', 'spy', 'monk'])).toEqual([]);
		});
		it.todo('Example 2: Ten players include two extra Outsiders');
		it.todo('Example 3: Puzzlemaster becomes Boomdandy, no Outsiders');
	});
});

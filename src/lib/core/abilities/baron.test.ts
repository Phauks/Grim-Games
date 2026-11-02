/**
 * Baron: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Baron
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Baron.
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
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { analyseSetup } from '#lib/core/rules/setup.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Baron', () => {
	const character = committedCharacter('baron');

	describe('data (roles.json)', () => {
		it('is a Minion from edition tb', () => {
			expect(character.name).toBe('Baron');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('baron')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Baron#Examples)', () => {
		it('Example 1: Seven players: Baron adds two Outsiders', () => {
			// Wiki: "The game is being set up for seven players, with five Townsfolk, one Minion, and one
			// Demon. Because the Minion is the Baron, the Storyteller removes two Townsfolk tokens and
			// adds a Saint and a Butler token. In total, three Townsfolk, two Outsider, one Minion, and
			// one Demon tokens go in the bag for the players to draw from."
			const s = scenario(['chef', 'empath', 'monk', 'saint', 'butler', 'baron', 'imp']);
			const inPlay = s.game.seating.map((seat) =>
				s.characters.get(s.game.seats[seat].characterId!)!
			);
			const result = analyseSetup({ players: 7, inPlay });
			expect(result.expected).toEqual({ townsfolk: [3], outsider: [2], minion: [1], demon: [1] });
			expect(result.warnings).toEqual([]);
		});
		it('Example 2: Hidden Drunk is actually an Outsider', () => {
			// Wiki: "The game is being set up for fifteen players, with nine Townsfolk, two Outsiders,
			// three Minions, and one Demon. Because the Baron is in play, the Storyteller must add a Drunk
			// and a Recluse. So, they remove the Monk token and add a Recluse token. Then, instead of
			// adding the Drunk character token, they add the Drunk's “Is the Drunk” reminder token to the
			// Grimoire... because this game, one player isn’t a Townsfolk—they are an Outsider: the Drunk.
			// All these character tokens go into the bag for the players to draw from."
			// Fifteen players: with the Baron, the Recluse replaces the Monk, and the Drunk goes in
			// as a Townsfolk token (here the Slayer) with the Drunk's reminder: the Drunk is one of
			// the four Outsiders, and the bag holds eight Townsfolk tokens.
			const data = committedGameData();
			const get = (...ids: string[]) => ids.map((id) => data.byId.get(id)!);
			const townsfolk = [
				'washerwoman',
				'librarian',
				'investigator',
				'chef',
				'empath',
				'fortuneteller',
				'undertaker',
				'slayer'
			];
			const outsiders = ['drunk', 'recluse', 'saint', 'butler'];
			const inPlay = get(...townsfolk, ...outsiders, 'baron', 'poisoner', 'spy', 'imp');
			const result = analyseSetup({ players: 15, inPlay });
			expect(result.expected).toMatchObject({ outsider: [4], minion: [3], demon: [1] });
			expect(result.chosen).toEqual({ townsfolk: 8, outsider: 4, minion: 3, demon: 1 });
			expect(result.warnings).toEqual([]);
			// In the grimoire the Drunk sits as the Townsfolk they think they are.
			const s = scenario(['slayer', 'recluse', 'baron', 'imp', 'chef']).drunk('slayer');
			expect(s.game.seats[s.seat('slayer')].characterId).toBe('slayer');
		});
	});
});

/**
 * Sentinel: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Sentinel
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Sentinel.
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
import { analyseSetup } from '#lib/core/rules/setup.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Sentinel', () => {
	const character = committedCharacter('sentinel');

	describe('data (roles.json)', () => {
		it('is a Fabled from edition fabled', () => {
			expect(character.name).toBe('Sentinel');
			expect(character.type).toBe('fabled');
			expect(character.edition).toBe('fabled');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('sentinel')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Sentinel#Examples)', () => {
		const data = committedGameData();
		const get = (...ids: string[]) => ids.map((id) => data.byId.get(id)!);

		it('Example 1: Demon bluffs Saint; Sentinel adds doubt', () => {
			// Wiki: "There are seven players in this game. There are no characters on the character
			// list that add Outsiders. The Demon bluffs as the Saint. A Sentinel is in play, so the
			// good players are not sure if there is actually a Saint or not."
			// Seven players normally have no Outsider; with the Sentinel there may be one.
			const s = scenario(['chef', 'empath', 'monk', 'soldier', 'mayor', 'poisoner', 'imp']).rule(
				'sentinel'
			);
			const inPlay = get(...s.game.seating.map((id) => s.game.seats[id].characterId!), 'sentinel');
			const result = analyseSetup({ players: 7, inPlay });
			expect(result.expected.outsider).toEqual([0, 1]);
			expect(result.warnings).toEqual([]);
			const withSaint = get(
				'chef',
				'empath',
				'monk',
				'soldier',
				'saint',
				'poisoner',
				'imp',
				'sentinel'
			);
			expect(analyseSetup({ players: 7, inPlay: withSaint }).warnings).toEqual([]);
		});
		it('Example 2: Witch bluffs Butler; Outsider count uncertain', () => {
			// Wiki: "There are nine players in this game. Even though a Baron is on the character
			// list, the good players know no Baron is in play because the Witch just killed a
			// player, so there should be just two Outsiders in play. However, the Outsiders cannot
			// be trusted because a Sentinel is in play. Indeed, there is one less Outsider than
			// normal in this game, and the Witch is bluffing as the Butler."
			// Nine players normally have two Outsiders; here there is one, and that is allowed.
			const inPlay = get(
				'chef',
				'empath',
				'monk',
				'soldier',
				'mayor',
				'slayer',
				'saint',
				'witch',
				'imp',
				'sentinel'
			);
			const result = analyseSetup({ players: 9, inPlay });
			expect(result.expected.outsider).toEqual([1, 2, 3]);
			expect(result.warnings).toEqual([]);
		});
	});
});

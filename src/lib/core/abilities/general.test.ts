/**
 * General: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/General
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes General.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { typeOf } from '#lib/core/model/selectors.ts';
import { protection } from '#lib/core/rules/ability.ts';
import { livingByTeam } from '#lib/core/rules/voting.ts';
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('General', () => {
	const character = committedCharacter('general');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('General');
			expect(character.type).toBe('townsfolk');
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

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('general')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/General#Examples)', () => {
		// No rule gives the General's answer: the Storyteller judges which team is winning.
		const needs = "the General's answer: a thumbs up, down or to the side, the Storyteller's call";

		it.fails('Example 1: Trusted Scarlet Woman tips evil ahead', () => {
			// Wiki: "There are 5 good players alive and 4 evil players alive. Even though the Demon is
			// very suspicious and will probably be executed next, there is a Scarlet Woman in play, who
			// is very trustworthy. The Storyteller gives a thumbs down."
			const cast = [
				'general',
				'chef',
				'empath',
				'monk',
				'soldier',
				'imp',
				'scarletwoman',
				'poisoner',
				'spy'
			];
			const s = scenario(cast).newDay();
			expect(livingByTeam(s.game)).toMatchObject({ alive: 9, good: 5, evil: 4 });
			engineGap('M15n', needs);
		});
		it.fails('Example 2: Good holds solid info; only Minion dead', () => {
			// Wiki: "The Good team has a lot of information, and believes that their false information
			// is indeed false. The only Minion is dead. The Storyteller gives a thumbs up."
			const s = scenario(['general', 'chef', 'empath', 'monk', 'imp', 'poisoner'])
				.execute('poisoner')
				.newDay();
			const minions = s.game.seating.filter((id) => typeOf(s.game, id, s.characters) === 'minion');
			expect(minions.every((id) => s.game.seats[id].dead)).toBe(true);
			engineGap('M15n', needs);
		});
		it.fails('Example 3: Uncertain outcome as Po may strike', () => {
			// Wiki: "The Po is a very experienced player and is coordinating well with the Minions. The
			// Monk is successfully protecting the Savant each night and the good team have correctly
			// identified several good players. However, the Po will probably kill 3 times tomorrow night,
			// so it is anyone’s game. The Storyteller gives a thumbs to the side."
			const s = scenario(['general', 'monk', 'savant', 'po', 'poisoner', 'chef'])
				.newDay()
				.reminder('savant', 'monk', 'Safe')
				.reminder('po', 'po', '3 Attacks');
			expect(protection(s.game, s.seat('savant'), s.characters, 'demon')).toMatchObject({
				characterId: 'monk'
			});
			engineGap('M15n', needs);
		});
	});
});

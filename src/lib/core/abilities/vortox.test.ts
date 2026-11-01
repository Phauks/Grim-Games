/**
 * Vortox: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Vortox
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Vortox.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { parseCharacter } from '#lib/core/data/parse.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { castGame, castWith, testCharacters } from '#lib/core/model/fixtures.test-support.ts';
import { reliability } from '#lib/core/rules/night-info.ts';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Vortox', () => {
	const character = committedCharacter('vortox');

	describe('data (roles.json)', () => {
		it('is a Demon from edition snv', () => {
			expect(character.name).toBe('Vortox');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('vortox')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Vortox#Examples)', () => {
		it.todo('Example 1: Vortox kills Sage; Sage sees non-Demons');
		it.todo("Example 2: Mutant's execution: two Townsfolk say yes");
		it.todo('Example 3: Dreamer narrows Savant to two characters');
		it.todo("Example 4: Pit-Hag's change gives Juggler true info");
		it('Example 5: Nobody executed, so evil wins', () => {
			const s = scenario(['chef', 'empath', 'monk', 'witch', 'vortox']).newDay();
			expect(gameEnds(s.game, s.characters, { dayEnded: true })).toMatchObject([
				{ rule: 'day-without-execution', winner: 'evil' }
			]);
		});
	});

	describe('Townsfolk information is false (its falseInfo rule)', () => {
		it('a Townsfolk must be given false information; an Outsider need not', () => {
			const { game: g, seats } = castGame(['chef', 'recluse', 'vortox', 'poisoner', 'monk']);
			expect(reliability(g, seats[0], 'chef', testCharacters)).toMatchObject({
				mustBeFalse: true,
				vortox: seats[2],
				falseBy: 'vortox'
			});
			expect(reliability(g, seats[1], 'recluse', testCharacters).mustBeFalse).toBeUndefined();
		});

		it('a poisoned Vortox makes nothing false', () => {
			const { game: g, seats } = castGame(
				['chef', 'empath', 'vortox', 'poisoner', 'monk'],
				(s) => ({
					type: 'AddReminder',
					seatId: s[2],
					reminder: { characterId: 'poisoner', label: 'Poisoned' }
				})
			);
			expect(reliability(g, seats[0], 'chef', testCharacters).mustBeFalse).toBeUndefined();
		});

		it('a custom character with the same rule makes its types false', () => {
			const issues = new Issues();
			const fog = parseCharacter(
				{
					id: 'fogbank',
					name: 'Fogbank',
					team: 'minion',
					ability: 'Outsider abilities yield false info.',
					rules: { falseInfo: { types: ['outsider'] } }
				},
				'[0]',
				issues,
				{ strict: false, scriptFields: true }
			);
			expect(issues.list).toEqual([]);
			const all = new Map([...testCharacters, [fog!.id, fog!]]);
			const { game: g, seats } = castWith({ characters: all })([
				'chef',
				'recluse',
				'imp',
				'fogbank',
				'monk'
			]);
			expect(reliability(g, seats[1], 'recluse', all)).toMatchObject({
				mustBeFalse: true,
				falseBy: 'fogbank'
			});
			expect(reliability(g, seats[0], 'chef', all).mustBeFalse).toBeUndefined();
		});
	});
});

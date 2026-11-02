/**
 * Bootlegger: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Bootlegger
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Bootlegger.
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
import { parseCharacter } from '#lib/core/data/parse.ts';
import { Issues } from '#lib/core/data/validate.ts';
import type { Script } from '#lib/core/data/index.ts';
import { startingRuleCharacters, withScriptRules } from '#lib/core/rules/script-rules.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Bootlegger', () => {
	const character = committedCharacter('bootlegger');

	describe('data (roles.json)', () => {
		it('is a Loric from edition loric', () => {
			expect(character.name).toBe('Bootlegger');
			expect(character.type).toBe('loric');
			expect(character.edition).toBe('loric');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['?', '?']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('bootlegger')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Bootlegger#Examples)', () => {
		const data = committedGameData();
		const official = ['chef', 'empath', 'monk', 'saint', 'poisoner', 'imp'];

		it('Example 1: Bootlegger for a homebrew character', () => {
			// Wiki: "The character sheet contains the homebrew character the Peasant. The
			// Storyteller announces that the Bootlegger is in play and then explains how the
			// Peasant works."
			// A script with a homebrew character starts the game with the Bootlegger in play.
			const issues = new Issues();
			const peasant = parseCharacter(
				{ id: 'peasant', name: 'Peasant', team: 'townsfolk', ability: 'A homebrew ability.' },
				'[0]',
				issues,
				{ strict: false, scriptFields: true }
			)!;
			expect(issues.list).toEqual([]);
			const script: Script = {
				meta: { name: 'Homebrew' },
				entries: [
					...official.map((id) => ({ kind: 'official' as const, id })),
					{ kind: 'custom', character: peasant }
				]
			};
			const characters = new Map([...data.byId, [peasant.id, peasant]]);
			const s = scenario(['peasant', 'chef', 'empath', 'poisoner', 'imp'], { script });
			expect(s.game.seats[s.seat('peasant')].characterId).toBe('peasant');
			expect(startingRuleCharacters(script, characters)).toEqual(['bootlegger']);
		});
		it('Example 2: Bootlegger for a house rule', () => {
			// Wiki: "The Storyteller has a homebrew or house rule. The Storyteller announces that
			// the Bootlegger is in play and explains what the homebrew rule is and how it will
			// affect the game."
			// The script's own rule makes the Bootlegger start in play, and its ability shows the rule.
			const rule = 'Each night, the Storyteller may wake one extra player.';
			const script: Script = {
				meta: { name: 'House', bootlegger: [rule] },
				entries: official.map((id) => ({ kind: 'official' as const, id }))
			};
			expect(startingRuleCharacters(script, data.byId)).toEqual(['bootlegger']);
			const sheet = withScriptRules(
				official.map((id) => data.byId.get(id)!),
				script.meta,
				data.byId.get('bootlegger')
			);
			expect(sheet.at(-1)).toMatchObject({ id: 'bootlegger', ability: rule });
		});
	});
});

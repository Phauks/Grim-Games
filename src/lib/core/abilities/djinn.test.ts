/**
 * Djinn: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Djinn
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Djinn.
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
import { dispatch } from '#lib/core/engine/index.ts';
import { activeJinxes, jinxSetupWarnings, scriptJinxes } from '#lib/core/rules/jinxes.ts';
import { startingRuleCharacters } from '#lib/core/rules/script-rules.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';

describe('Djinn', () => {
	const character = committedCharacter('djinn');

	describe('data (roles.json)', () => {
		it('is a Fabled from edition fabled', () => {
			expect(character.name).toBe('Djinn');
			expect(character.type).toBe('fabled');
			expect(character.edition).toBe('fabled');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('djinn')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Djinn#Examples)', () => {
		const data = committedGameData();
		const pair = (ids: readonly string[]) => [...ids].sort().join('+');

		it.fails('Example 1: Storyteller blocks Pit-Hag from creating Heretic', () => {
			// Wiki: "The Pit-Hag and the Heretic are Jinxed. At the start of the game, the
			// Storyteller reads out the Djinn's special rule: “A Pit-Hag cannot create a Heretic.”
			// Later in the game, the Pit-Hag tries to create a Heretic. The Storyteller shakes
			// their head, and the Pit-Hag must choose another character to create."
			// Waits on the engine (L100): the jinx shows on the script and warns at setup, but turning a
			// player into the Heretic while the Pit-Hag is in play gives no jinx warning.
			const jinxes = scriptJinxes(data.jinxes, ['pithag', 'heretic', 'chef', 'imp']);
			expect(jinxes.map((j) => pair(j.characters))).toEqual(['heretic+pithag']);
			expect(jinxSetupWarnings(jinxes, ['pithag', 'heretic'])).toHaveLength(1);
			const s = scenario(['pithag', 'chef', 'empath', 'monk', 'imp']);
			const result = dispatch(
				s.session,
				{ type: 'AssignCharacter', seatId: s.seat('chef'), characterId: 'heretic' },
				s.ctx
			);
			expect(result.ok && result.warnings.some((w) => /jinx/i.test(w.message))).toBe(true);
		});
		it('Example 2: Spy jinx read aloud to hide Minion', () => {
			// Wiki: "The Spy and the Magician are Jinxed. At the start of the game, the Storyteller
			// reads out the Djinn's special rule: "When the Spy sees the grimoire, the Demon and
			// the Magician's character tokens are removed." There is no Spy and no Magician in
			// play, but the Storyteller reads this aloud anyway so that the good team doesn't know
			// which Minion is in play."
			// The jinx is on the script whether or not either character is in play; the Djinn
			// itself is never put in play by the app, since jinxes show on their own.
			const ids = ['spy', 'magician', 'chef', 'empath', 'poisoner', 'imp'];
			const jinxes = scriptJinxes(data.jinxes, ids);
			expect(jinxes.map((j) => pair(j.characters))).toEqual(['magician+spy']);
			expect(activeJinxes(jinxes, ['chef', 'empath', 'poisoner', 'imp'])).toEqual([]);
			const script = {
				meta: { name: 'Jinxed' },
				entries: [...ids, 'djinn'].map((id) => ({ kind: 'official' as const, id }))
			};
			expect(startingRuleCharacters(script, data.byId)).toEqual([]);
		});
	});
});

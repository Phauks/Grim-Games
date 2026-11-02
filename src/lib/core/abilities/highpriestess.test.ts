/**
 * High Priestess: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/High_Priestess
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes High Priestess.
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
import { infoPicker, isAllowed } from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('High Priestess', () => {
	const character = committedCharacter('highpriestess');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('High Priestess');
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
			expect(nightSheetPresence('highpriestess')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/High_Priestess#Examples)', () => {
		// Waits on the engine: the High Priestess has no `learns` rule, so infoPicker gives her
		// night step no picker of one player.
		it.fails('Example 1: Three nights: Chef, Goblin, then misleading Drunk', () => {
			// Wiki: "On the first night, the High Priestess learns Julian. Julian is the Chef and has
			// useful information to share. On the second night, the High Priestess is shown Marianna.
			// Marianna is the Goblin and the Storyteller thinks that the High Priestess would benefit
			// most from talking to Marianna to find this out as early as possible. On the third night,
			// the High Priestess is shown Doug. Doug is the Drunk whose information is wrong and harming
			// the good team."
			// Doug is the Drunk who thinks he is the Empath. Any player is a valid answer.
			const s = scenario(['highpriestess', 'chef', 'goblin', 'empath', 'monk', 'imp']).drunk(
				'empath'
			);
			const picker = infoPicker(s.game, s.seat('highpriestess'), 'highpriestess', s.characters);
			expect(picker).toBeDefined();
			for (const seat of ['chef', 'goblin', 'empath'] as const) {
				expect(isAllowed(picker!, { seats: [s.seat(seat)] })).toBe(true);
			}
		});
		// Waits on the engine: the High Priestess has no `learns` rule, so infoPicker gives her
		// night step no picker of one player.
		it.fails('Example 2: Saint for three nights, then the Imp', () => {
			// Wiki: "For three nights in a row, the High Priestess learns Sarah. Sarah is the Saint and the
			// good team are trying to execute her. On the last night, the High Priestess learns Lewis.
			// Lewis is the Imp, and his story is clashing with several good players."
			const s = scenario(['highpriestess', 'saint', 'imp', 'chef', 'monk', 'poisoner']);
			const picker = infoPicker(s.game, s.seat('highpriestess'), 'highpriestess', s.characters);
			expect(picker).toBeDefined();
			expect(isAllowed(picker!, { seats: [s.seat('saint')] })).toBe(true);
			expect(isAllowed(picker!, { seats: [s.seat('imp')] })).toBe(true);
		});
	});
});

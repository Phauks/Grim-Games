/**
 * Saint: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Saint
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Saint.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { executedInstead } from '#lib/core/rules/executed-instead.ts';
import { promptable } from '#lib/core/rules/game-end.ts';

describe('Saint', () => {
	const character = committedCharacter('saint');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition tb', () => {
			expect(character.name).toBe('Saint');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('saint')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Saint#Examples)', () => {
		it('Example 1: Saint executed, so evil wins', () => {
			// Wiki: "There are seven players alive and nominations are in progress. The Saint gets four
			// votes and is about to die. Then, the Baron is nominated but only gets three votes. No more
			// nominations occur today. The Saint is executed, and evil wins."
			const s = scenario(['saint', 'chef', 'empath', 'baron', 'imp']).execute('saint');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'executed-loses', winner: 'evil' }
			]);
		});
		it('Example 2: Gunslinger kills Saint; game continues', () => {
			// Wiki: "The Imp is nominated, and the players vote. The Gunslinger kills the Saint. The Saint
			// dies, and the game continues."
			const s = scenario(['saint', 'chef', 'empath', 'baron', 'imp', 'gunslinger']).dies(
				'saint',
				'gunslinger'
			);
			expect(gameEnds(s.game, s.characters)).toEqual([]);
		});
		it("Example 3: Scapegoat dies in Saint's place; game continues", () => {
			// Wiki: "The Saint is executed. However, the Scapegoat's ability is triggered, so the
			// Scapegoat dies instead. The game continues, because the Saint did not die."
			const s = scenario(['saint', 'scapegoat', 'imp', 'chef', 'poisoner']).becomes(
				'scapegoat',
				'scapegoat',
				'good'
			);
			expect(executedInstead(s.game, s.seat('saint'), s.characters)).toEqual([
				{ seatId: s.seat('scapegoat'), characterId: 'scapegoat' }
			]);
			const after = s.execute('scapegoat');
			expect(promptable(gameEnds(after.game, after.characters))).toEqual([]);
		});
	});
});

/**
 * Hidden extras: A Script of Infinite Possibilities
 * (https://chillclocktower.com/2024/04/28/a-script-of-infinite-possibilities/).
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { announcedRange, extraCandidates, extraTotal, rollExtras } from './extras.ts';
import { NO_RESTRICTIONS, runsPart } from './pool.ts';
import { withRules } from './combine.ts';
import { STANDARD } from './registry.ts';
import { INFINITE_POSSIBILITIES } from './rules/index.ts';

const data = committedGameData();
const tb = data.characters.filter((c) => c.edition === 'tb');
// Since 2026-10-18 a special rule, played here on Standard.
const infinite = withRules(STANDARD, [INFINITE_POSSIBILITIES]);

describe('rollExtras', () => {
	// Trevor, 2026-10-18: "1-4 hidden extra characters from off the script".
	it('adds 1 to 4 characters from off the script, of the mode’s row types', () => {
		expect(extraTotal(infinite)).toEqual({ min: 1, max: 4 });
		const seen = new Set<number>();
		for (let i = 0; i < 200; i++) {
			const extras = rollExtras(infinite, tb, data.characters, NO_RESTRICTIONS, Math.random);
			seen.add(extras.length);
			expect(extras.length).toBeGreaterThanOrEqual(1);
			expect(extras.length).toBeLessThanOrEqual(4);
			for (const c of extras) {
				expect(['townsfolk', 'outsider', 'minion']).toContain(c.type);
				expect(tb.some((t) => t.id === c.id)).toBe(false);
			}
			expect(extras.filter((c) => c.type === 'minion').length).toBeLessThanOrEqual(1);
		}
		expect([...seen].sort()).toEqual([1, 2, 3, 4]);
	});

	it('never picks a restricted character', () => {
		const minions = extraCandidates(infinite, 'minion', tb, data.characters, NO_RESTRICTIONS);
		const banned = minions.slice(1).map((c) => c.id);
		// random() 0.99 keeps every row, so the Minion row is filled.
		const extras = rollExtras(infinite, tb, data.characters, { banned, allowed: [] }, () => 0.99);
		expect(extras.find((c) => c.type === 'minion')?.id).toBe(minions[0].id);
	});

	it('adds none for a mode without hidden extras', () => {
		expect(rollExtras(STANDARD, tb, data.characters, NO_RESTRICTIONS, Math.random)).toEqual([]);
	});
});

describe('announcedRange', () => {
	it('is one either side, never below none', () => {
		expect(announcedRange(2)).toEqual([1, 3]);
		expect(announcedRange(0)).toEqual([0, 1]);
	});
});

describe('runsPart', () => {
	it('runs the hidden extras pool itself', () => {
		expect(runsPart(infinite, 'pool')).toBe(true);
	});
});

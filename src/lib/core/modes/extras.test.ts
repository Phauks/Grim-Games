/**
 * Hidden extras: A Script of Infinite Possibilities
 * (https://chillclocktower.com/2024/04/28/a-script-of-infinite-possibilities/).
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { announcedRange, extraCandidates, rollExtras } from './extras.ts';
import { NO_RESTRICTIONS, runsPart } from './pool.ts';
import { gameModeById } from './registry.ts';

const data = committedGameData();
const tb = data.characters.filter((c) => c.edition === 'tb');
const infinite = gameModeById('infinite-possibilities')!;

describe('rollExtras', () => {
	it('adds one Townsfolk and one Minion from off the script', () => {
		const extras = rollExtras(infinite, tb, data.characters, NO_RESTRICTIONS, Math.random);
		expect(extras.map((c) => c.type)).toEqual(['townsfolk', 'minion']);
		for (const c of extras) expect(tb.some((t) => t.id === c.id)).toBe(false);
	});

	it('never picks a restricted character', () => {
		const minions = extraCandidates(infinite, 'minion', tb, data.characters, NO_RESTRICTIONS);
		const banned = minions.slice(1).map((c) => c.id);
		const extras = rollExtras(infinite, tb, data.characters, { banned, allowed: [] }, Math.random);
		expect(extras[1].id).toBe(minions[0].id);
	});

	it('adds none for a mode without hidden extras', () => {
		expect(
			rollExtras(gameModeById('standard')!, tb, data.characters, NO_RESTRICTIONS, Math.random)
		).toEqual([]);
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

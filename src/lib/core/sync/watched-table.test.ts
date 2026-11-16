import { describe, expect, it } from 'vitest';
import type { SharedGrimoire } from './shared-grimoire.ts';
import { watchedTable } from './watched-table.ts';

const shared = (extra: Partial<SharedGrimoire>): SharedGrimoire =>
	({ saved: {}, ...extra }) as SharedGrimoire;

describe('watchedTable', () => {
	it('keeps the table and how the game ended', () => {
		const table = { seats: [] };
		expect(watchedTable(shared({ table, ended: { winner: 'evil', reason: 'Demon won' } }))).toEqual(
			{ table, ended: { winner: 'evil', reason: 'Demon won' } }
		);
	});

	it('leaves out a missing or malformed part', () => {
		expect(watchedTable(shared({}))).toEqual({});
		expect(watchedTable(shared({ table: { seats: 'no' }, ended: 'over' }))).toEqual({});
		expect(watchedTable(shared({ ended: { winner: 'nobody', reason: 3 } }))).toEqual({ ended: {} });
	});
});

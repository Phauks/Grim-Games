/**
 * Sorting and filtering the Character reference table. The data is TPI's (roles.json,
 * nightsheet.json); alignment from type follows
 * https://wiki.bloodontheclocktower.com/Character_Types.
 */
import { describe, expect, it } from 'vitest';
import { committedGameData, committedNumericNightOrder } from '#lib/core/testing/committed-data.ts';
import { characterReference } from './reference.ts';
import {
	activeFilterCount,
	nextSort,
	parseTableState,
	tableRows,
	type TableState
} from './reference-table.ts';

const data = committedGameData();
const entries = characterReference(data, committedNumericNightOrder());
const ids = (state: TableState) => tableRows(entries, state).map((e) => e.character.id);

describe('tableRows', () => {
	it('keeps the default order with no sort or filters', () => {
		expect(ids({ filters: {} })).toEqual(entries.map((e) => e.character.id));
	});

	it('sorts by first night position, characters that do not wake last', () => {
		const rows = tableRows(entries, {
			sort: { column: 'firstNight', direction: 'ascending' },
			filters: {}
		});
		const positions = rows.map((e) => e.firstNight.position);
		const woken = positions.filter((p) => p !== undefined);
		expect(woken).toEqual([...woken].sort((a, b) => a - b));
		expect(positions.slice(woken.length).every((p) => p === undefined)).toBe(true);
		const down = tableRows(entries, {
			sort: { column: 'firstNight', direction: 'descending' },
			filters: {}
		}).map((e) => e.firstNight.position);
		expect(down[0]).toBe(Math.max(...woken));
	});

	it('sorts names alphabetically', () => {
		const names = tableRows(entries, {
			sort: { column: 'name', direction: 'ascending' },
			filters: {}
		}).map((e) => e.character.name.toLowerCase());
		expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
	});

	it('filters by type, alignment, presence and name', () => {
		const demons = tableRows(entries, { filters: { types: ['demon'] } });
		expect(demons.length).toBeGreaterThan(0);
		expect(demons.every((e) => e.character.type === 'demon')).toBe(true);
		expect(ids({ filters: { alignment: 'Storyteller chooses' } })).toContain('gunslinger');
		const quiet = tableRows(entries, { filters: { firstNight: 'no', otherNight: 'no' } });
		expect(quiet.every((e) => !e.firstNight.text && !e.otherNight.text)).toBe(true);
		expect(ids({ filters: { jinxes: 'yes', types: ['minion'] } })).toContain('spy');
		expect(ids({ filters: { name: 'witch' } })).toEqual(['witch']);
	});
});

describe('tokens filter', () => {
	it('filters by edition, matching any chosen edition', () => {
		const rows = tableRows(entries, { filters: { editions: ['tb', 'bmr'] } });
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.every((e) => ['tb', 'bmr'].includes(e.character.edition ?? ''))).toBe(true);
		expect(ids({ filters: { editions: ['tb'] } })).toContain('imp');
		expect(ids({ filters: { editions: ['tb'] } })).not.toContain('zombuul');
		expect(activeFilterCount({ editions: ['tb'] })).toBe(1);
		expect(parseTableState({ filters: { editions: ['snv', 3, ''] } }).filters).toEqual({
			editions: ['snv']
		});
	});

	it('splits characters with tokens by whether any is placed at setup', () => {
		const setup = ids({ filters: { tokens: 'setup' } });
		const notSetup = ids({ filters: { tokens: 'not-setup' } });
		expect(setup).toContain('washerwoman');
		expect(setup).toContain('nodashii');
		expect(notSetup).toContain('imp');
		expect(setup).not.toContain('chef');
		expect(notSetup).not.toContain('chef');
		expect(setup.filter((id) => notSetup.includes(id))).toEqual([]);
		expect(setup.length + notSetup.length).toBe(ids({ filters: { tokens: 'yes' } }).length);
		expect(parseTableState({ filters: { tokens: 'not-setup' } }).filters.tokens).toBe('not-setup');
		expect(parseTableState({ filters: { setup: 'not-setup' } }).filters.setup).toBeUndefined();
	});
});

describe('table state', () => {
	it('cycles a header between ascending and descending', () => {
		const a = nextSort(undefined, 'type');
		expect(a).toEqual({ column: 'type', direction: 'ascending' });
		expect(nextSort(a, 'type').direction).toBe('descending');
		expect(nextSort(nextSort(a, 'type'), 'type').direction).toBe('ascending');
		expect(nextSort(a, 'name')).toEqual({ column: 'name', direction: 'ascending' });
	});

	it('counts active filters', () => {
		expect(activeFilterCount({})).toBe(0);
		expect(activeFilterCount({ name: ' ', types: [] })).toBe(0);
		expect(activeFilterCount({ name: 'x', types: ['demon'], setup: 'no' })).toBe(3);
	});

	it('reads stored state forgivingly', () => {
		expect(parseTableState(null)).toEqual({ filters: {} });
		expect(
			parseTableState({
				sort: { column: 'firstNight', direction: 'descending' },
				filters: { types: ['demon', 'dragon'], alignment: 'Purple', tokens: 'yes', name: 7 }
			})
		).toEqual({
			sort: { column: 'firstNight', direction: 'descending' },
			filters: { types: ['demon'], tokens: 'yes' }
		});
	});
});

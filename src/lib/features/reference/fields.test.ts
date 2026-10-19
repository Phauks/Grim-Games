import { describe, expect, it } from 'vitest';
import { TABLE_COLUMNS } from '#lib/core/rules/reference-table.ts';
import { FIELD_IDS, REFERENCE_FIELDS, tableFieldIds } from './fields.ts';

describe('reference fields', () => {
	it('shows every field as a table column', () => {
		expect(tableFieldIds()).toEqual([...FIELD_IDS]);
		expect(REFERENCE_FIELDS.map((f) => f.id)).toEqual([...FIELD_IDS]);
	});

	it('sorts by every sortable core column, once each', () => {
		const sorts = REFERENCE_FIELDS.flatMap((f) => (f.sort ? [f.sort] : []));
		expect([...sorts].sort()).toEqual([...TABLE_COLUMNS].sort());
	});
});

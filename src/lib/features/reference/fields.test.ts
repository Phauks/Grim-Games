import { describe, expect, it } from 'vitest';
import { FIELD_IDS, REFERENCE_FIELDS, tableFieldIds } from './fields.ts';

describe('reference fields', () => {
	it('shows every field as a table column', () => {
		expect(tableFieldIds()).toEqual([...FIELD_IDS]);
		expect(REFERENCE_FIELDS.map((f) => f.id)).toEqual([...FIELD_IDS]);
	});
});

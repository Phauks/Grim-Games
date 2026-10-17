import { describe, expect, it } from 'vitest';
import { emptyDraft, isEmptyDraft, parseDraft } from './draft.ts';

describe('script builder draft', () => {
	it('reads a stored draft', () => {
		expect(
			parseDraft({ version: 1, name: 'Mine', author: 'T', ids: ['chef', 'imp'], editing: 'x' })
		).toEqual({ version: 1, name: 'Mine', author: 'T', ids: ['chef', 'imp'], editing: 'x' });
	});

	it('starts empty when the draft is missing, damaged or from a newer build', () => {
		expect(parseDraft(null)).toEqual(emptyDraft());
		expect(parseDraft('nonsense')).toEqual(emptyDraft());
		expect(parseDraft({ version: 2, name: 'Later', ids: ['chef'] })).toEqual(emptyDraft());
	});

	it('drops ids that are not text, and repeats', () => {
		expect(parseDraft({ version: 1, ids: ['chef', 3, 'chef'] }).ids).toEqual(['chef']);
	});

	it('counts blank details as empty', () => {
		expect(isEmptyDraft({ ...emptyDraft(), name: '  ' })).toBe(true);
		expect(isEmptyDraft({ ...emptyDraft(), ids: ['chef'] })).toBe(false);
	});
});

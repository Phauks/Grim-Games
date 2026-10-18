import { describe, expect, it } from 'vitest';
import { chosenHomebrew, emptyDraft, isEmptyDraft, isTeensyville, parseDraft } from './draft.ts';

describe('script builder draft', () => {
	it('reads a stored draft', () => {
		const stored = {
			version: 3,
			name: 'Mine',
			author: 'T',
			scriptVersion: '1.2',
			teensyville: true,
			ids: ['chef', 'lantern'],
			homebrew: { lantern: { id: 'lantern', team: 'outsider' } },
			credits: { lantern: { creator: 'DJ', url: 'https://botchomebrew.wiki/c/lantern' } },
			editing: 'x',
			variationOf: { name: 'Trouble Brewing', source: { kind: 'edition' }, json: [{ id: '_meta' }] }
		};
		expect(parseDraft(stored)).toEqual(stored);
	});

	it('keeps Teensyville only when it is set', () => {
		expect(parseDraft({ version: 3, ids: [], teensyville: 'yes' }).teensyville).toBeUndefined();
	});

	it('judges an opened script Teensyville by its size, and an empty one full', () => {
		expect(isTeensyville(0)).toBe(false);
		expect(isTeensyville(11)).toBe(true);
		expect(isTeensyville(22)).toBe(false);
	});

	it('reads a version 2 draft, which has no variation', () => {
		expect(parseDraft({ version: 2, name: 'Two', ids: ['chef'] })).toEqual({
			...emptyDraft(),
			name: 'Two',
			ids: ['chef']
		});
	});

	it('drops a variation it cannot read', () => {
		const draft = parseDraft({ version: 3, ids: ['chef'], variationOf: { name: 'X', json: [] } });
		expect(draft.variationOf).toBeUndefined();
	});

	it('brings a version 1 draft (official characters only) up to date', () => {
		expect(parseDraft({ version: 1, name: 'Old', author: '', ids: ['chef'] })).toEqual({
			...emptyDraft(),
			name: 'Old',
			ids: ['chef']
		});
	});

	it('starts empty when the draft is missing, damaged or from a newer build', () => {
		expect(parseDraft(null)).toEqual(emptyDraft());
		expect(parseDraft('nonsense')).toEqual(emptyDraft());
		expect(parseDraft({ version: 4, name: 'Later', ids: ['chef'] })).toEqual(emptyDraft());
	});

	it('drops ids that are not text, repeats, and homebrew that is not an object', () => {
		const draft = parseDraft({ version: 2, ids: ['chef', 3, 'chef'], homebrew: { x: 'no' } });
		expect(draft.ids).toEqual(['chef']);
		expect(draft.homebrew).toEqual({});
	});

	it('counts blank details as empty', () => {
		expect(isEmptyDraft({ ...emptyDraft(), name: '  ' })).toBe(true);
		expect(isEmptyDraft({ ...emptyDraft(), ids: ['chef'] })).toBe(false);
		expect(isEmptyDraft({ ...emptyDraft(), scriptVersion: '2' })).toBe(false);
	});

	it('keeps homebrew definitions only for chosen characters', () => {
		const draft = {
			...emptyDraft(),
			ids: ['a'],
			homebrew: { a: { id: 'a' }, b: { id: 'b' } }
		};
		expect(chosenHomebrew(draft)).toEqual({ a: { id: 'a' } });
	});
});

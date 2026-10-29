import { describe, expect, it } from 'vitest';
import {
	blankEditor,
	editorAsks,
	editorDetail,
	editorFor,
	wholeNumber
} from './custom-token-editor.ts';
import type { CustomInfoToken } from './custom-tokens.ts';

const card = (asks: CustomInfoToken['asks']): CustomInfoToken => ({
	id: 'c1',
	text: 'You learn',
	source: 'custom',
	asks
});

describe('custom info card editor', () => {
	it('opens a new card blank, asking for nothing', () => {
		expect(editorFor()).toEqual(blankEditor());
		expect(editorAsks(blankEditor())).toEqual({
			characters: undefined,
			exactly: undefined,
			fewest: undefined,
			notInPlay: undefined,
			value: undefined
		});
		expect(editorDetail(blankEditor())).toBeUndefined();
	});

	it('gives back what a card asks for: an exact count and a number', () => {
		const asks = {
			characters: 2,
			exactly: true as const,
			value: { kind: 'number' as const, min: 0, max: 5 }
		};
		const fields = editorFor(card(asks));
		expect(fields).toMatchObject({ count: 'exact', characters: 2, input: 'number', min: '0' });
		expect(editorAsks(fields)).toMatchObject(asks);
		expect(editorDetail(fields)).toBe('0');
	});

	it('reads a range of characters, from its fewest to its most', () => {
		const fields = editorFor(card({ characters: 3, fewest: 2 }));
		expect(fields).toMatchObject({ count: 'range', characters: 3, fewest: 2 });
		expect(editorAsks(fields)).toMatchObject({ characters: 3, fewest: 2, exactly: undefined });
	});

	it('keeps only whole numbers as typed, minus in front', () => {
		expect(wholeNumber(' -1a2')).toBe('-12');
		expect(wholeNumber('3-4')).toBe('34');
	});

	it('previews the first answer of a choices card', () => {
		expect(editorDetail({ ...blankEditor(), input: 'choices', choices: [' ', 'Yes'] })).toBe('Yes');
	});
});

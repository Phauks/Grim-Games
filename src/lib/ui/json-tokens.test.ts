import { describe, expect, it } from 'vitest';
import { jsonLineTokens } from './json-tokens.ts';

describe('jsonLineTokens', () => {
	it('tells names from text, numbers, true/false/null and punctuation', () => {
		expect(jsonLineTokens('  "name": "Whale Buffet",')).toEqual([
			{ kind: 'plain', text: '  ' },
			{ kind: 'key', text: '"name"' },
			{ kind: 'punctuation', text: ':' },
			{ kind: 'plain', text: ' ' },
			{ kind: 'string', text: '"Whale Buffet"' },
			{ kind: 'punctuation', text: ',' }
		]);
		expect(jsonLineTokens('"min": -1.5e2, "on": true, "x": null}')).toContainEqual({
			kind: 'number',
			text: '-1.5e2'
		});
		expect(jsonLineTokens('[false, null]').map((t) => t.kind)).toEqual([
			'punctuation',
			'literal',
			'punctuation',
			'plain',
			'literal',
			'punctuation'
		]);
	});

	it('keeps escaped quotes and digits inside text as text', () => {
		expect(jsonLineTokens('"say \\"hi\\" 3 times"')).toEqual([
			{ kind: 'string', text: '"say \\"hi\\" 3 times"' }
		]);
	});

	it('loses nothing, even from broken JSON', () => {
		for (const line of ['  "id": "x",', 'not json at all', '{"a":', '"open'])
			expect(
				jsonLineTokens(line)
					.map((t) => t.text)
					.join('')
			).toBe(line);
	});
});

import { describe, expect, it } from 'vitest';
import { relaxJson } from './relaxed-json.ts';

describe('relaxJson', () => {
	it('leaves valid JSON as it is', () => {
		const text = '[{"id":"_meta","name":"A // B"},"imp"]';
		expect(relaxJson(text)).toBe(text);
	});

	it('drops comments and trailing commas', () => {
		const text = `[
			// The script's name
			{ "id": "_meta", "name": "Hand Made", }, /* the Demon */
			"imp",
		]`;
		expect(JSON.parse(relaxJson(text))).toEqual([{ id: '_meta', name: 'Hand Made' }, 'imp']);
	});

	it('keeps comment-like text and commas inside strings', () => {
		const text = '["a, ]", {"name": "x /* y */ // z \\" ,}",},]';
		expect(JSON.parse(relaxJson(text))).toEqual(['a, ]', { name: 'x /* y */ // z " ,}' }]);
	});

	it('leaves text it cannot mend for the loader to report', () => {
		expect(() => JSON.parse(relaxJson('[imp'))).toThrow();
	});
});

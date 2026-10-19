import { describe, expect, it } from 'vitest';
import { bylineParts, gameLine } from './byline.ts';

describe("a script's byline", () => {
	it('names what is known, in order', () => {
		expect(bylineParts({ author: ' Kim ', version: '2', storyteller: 'Sam' })).toEqual([
			'by Kim',
			'v2',
			'Storyteller: Sam'
		]);
		expect(bylineParts({ author: ' ', storyteller: '' })).toEqual([]);
	});

	// Trevor, 2026-10-19: share text names the script with its version, author and Storyteller.
	it('puts a game in one line, leaving out what is missing', () => {
		expect(
			gameLine('Trouble Brewing', {
				version: '2',
				author: 'The Pandemonium Institute',
				storyteller: 'Sam'
			})
		).toBe('Trouble Brewing v2 by The Pandemonium Institute · Storyteller: Sam');
		expect(gameLine('Storm Front', {})).toBe('Storm Front');
		expect(gameLine('', { storyteller: 'Sam' })).toBe('Storyteller: Sam');
		expect(gameLine(undefined, {})).toBe('');
	});
});

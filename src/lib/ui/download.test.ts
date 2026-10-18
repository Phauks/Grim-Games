import { describe, expect, it } from 'vitest';
import { fileNameFor } from './download.ts';

describe('fileNameFor', () => {
	it('joins words with dashes', () => {
		expect(fileNameFor(' Trouble  Brewing! ', 'script')).toBe('trouble-brewing.json');
	});
	it('falls back when nothing is left', () => {
		expect(fileNameFor('???', 'character')).toBe('character.json');
	});
});

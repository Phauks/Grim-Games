import { describe, expect, it } from 'vitest';
import { wikiUrl } from './wiki.ts';

describe('wikiUrl', () => {
	it('uses underscores for spaces', () => {
		expect(wikiUrl({ name: 'Fortune Teller', edition: 'tb' })).toBe(
			'https://wiki.bloodontheclocktower.com/Fortune_Teller'
		);
	});

	it('encodes apostrophes and keeps hyphens', () => {
		expect(wikiUrl({ name: "Lil' Monsta", edition: 'carousel' })).toBe(
			"https://wiki.bloodontheclocktower.com/Lil'_Monsta"
		);
		expect(wikiUrl({ name: 'Al-Hadikhia', edition: 'carousel' })).toBe(
			'https://wiki.bloodontheclocktower.com/Al-Hadikhia'
		);
	});

	it('has no page for homebrew characters', () => {
		expect(wikiUrl({ name: 'My Homebrew' })).toBeUndefined();
	});
});

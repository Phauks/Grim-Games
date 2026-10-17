import { describe, expect, it } from 'vitest';
import { creditKey, readCollections, readCredits } from './homebrew-wiki-api.ts';

describe('Homebrew Wiki answers', () => {
	it('lists collections by display name, keeping only kebab ids', () => {
		expect(
			readCollections([
				{
					id: 'temple-fair',
					slug: 'Festival of Lanterns — Temple Fair',
					displayName: 'Temple Fair'
				},
				{ id: 'academy', slug: 'The Academy' },
				{ id: 'Bad Id', displayName: 'Nope' },
				'junk'
			])
		).toEqual([
			{ id: 'temple-fair', name: 'Temple Fair' },
			{ id: 'academy', name: 'The Academy' }
		]);
		expect(readCollections({})).toEqual([]);
	});

	it('compares names without case, accents or punctuation', () => {
		expect(creditKey('Folie à Deux')).toBe(creditKey('folie a deux!'));
	});

	it('credits only the characters on the script, once each, linking their wiki page', () => {
		const script = [
			{ id: '_meta', name: 'Temple Fair' },
			{ id: 'foliea', name: 'Folie à Deux' },
			'imp'
		];
		const grid = [
			{ name: 'Folie à Deux', creator: 'DJ', page: 'c/folie-a-deux' },
			{ name: 'Folie a Deux', creator: 'Someone else', page: 'c/other' },
			{ name: 'Pozzo', creator: 'X', page: 'c/pozzo' }
		];
		expect(readCredits(grid, script)).toEqual([
			{ name: 'Folie à Deux', creator: 'DJ', url: 'https://botchomebrew.wiki/c/folie-a-deux' }
		]);
	});
});

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

	it("links a character to its own collection's page when another has the same name", () => {
		// https://botchomebrew.wiki/c/call-of-the-executioner/glassblower-2: the wiki's second
		// Glassblower, after one in another collection.
		const script = [
			{ id: '_meta', name: 'Call of the Executioner' },
			{ id: 'glassblower', name: 'Glassblower' }
		];
		const grid = [
			{
				slug: 'glassblower',
				page: 'c/other-collection/glassblower',
				name: 'Glassblower',
				creator: 'A'
			},
			{
				slug: 'glassblower-2',
				page: 'c/call-of-the-executioner/glassblower-2',
				name: 'Glassblower',
				creator: 'B'
			}
		];
		expect(readCredits(grid, script, 'call-of-the-executioner')).toEqual([
			{
				name: 'Glassblower',
				creator: 'B',
				url: 'https://botchomebrew.wiki/c/call-of-the-executioner/glassblower-2'
			}
		]);
		// Without its own row, the first of that name elsewhere.
		expect(readCredits(grid.slice(0, 1), script, 'call-of-the-executioner')).toEqual([
			{
				name: 'Glassblower',
				creator: 'A',
				url: 'https://botchomebrew.wiki/c/other-collection/glassblower'
			}
		]);
	});
});

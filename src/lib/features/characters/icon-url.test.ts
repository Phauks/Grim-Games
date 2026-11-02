import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { fallbackIconUrl, iconUrl } from './icon-url.ts';

const data = committedGameData();
const get = (id: string) => data.byId.get(id)!;

describe('iconUrl (a reminder or token icon shows its player’s alignment)', () => {
	it('draws an evil Minion’s icon red', () => {
		expect(iconUrl(get('poisoner'))).toMatch(/poisoner_e\.webp$/);
	});
	it('draws a good character’s icon blue, and red once that player is evil', () => {
		expect(iconUrl(get('washerwoman'))).toMatch(/washerwoman_g\.webp$/);
		expect(iconUrl(get('washerwoman'), 'evil')).toMatch(/washerwoman_e\.webp$/);
	});
	it('draws a Minion whose player turned good blue', () => {
		expect(iconUrl(get('poisoner'), 'good')).toMatch(/poisoner_g\.webp$/);
	});
	it('draws a homebrew character’s second image once its player flips alignment', () => {
		const homebrew = {
			...get('poisoner'),
			id: 'sample-homebrew',
			edition: undefined,
			image: ['https://example.test/regular.png', 'https://example.test/flipped.png']
		};
		expect(iconUrl(homebrew)).toBe('https://example.test/regular.png');
		expect(iconUrl(homebrew, 'good')).toBe('https://example.test/flipped.png');
	});
	it('gives a homebrew character without an image TPI’s generic icon for its type', () => {
		const homebrew = {
			...get('poisoner'),
			id: 'sample-homebrew',
			edition: undefined,
			image: undefined
		};
		expect(iconUrl(homebrew)).toBe('/data/icons/generic/minion_e.webp');
		expect(iconUrl(homebrew, 'good')).toBe('/data/icons/generic/minion_g.webp');
	});
	it('falls back to TPI’s generic icon when a homebrew image won’t load', () => {
		const homebrew = {
			...get('washerwoman'),
			id: 'sample-homebrew',
			edition: undefined,
			image: 'https://example.invalid/missing.png'
		};
		expect(fallbackIconUrl(homebrew)).toBe('/data/icons/generic/townsfolk_g.webp');
		expect(fallbackIconUrl(homebrew, 'evil')).toBe('/data/icons/generic/townsfolk_e.webp');
	});
	it('falls back to the generic icon for an official character too, never a broken image', () => {
		expect(fallbackIconUrl(get('washerwoman'))).toBe('/data/icons/generic/townsfolk_g.webp');
		expect(fallbackIconUrl(get('imp'))).toBe('/data/icons/generic/demon_e.webp');
	});
});

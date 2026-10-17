import { describe, expect, it } from 'vitest';
import { genericIcons, homebrewImage } from './icons.ts';

// TPI's script schema (static/data/script-schema.json, `image`): a list holds the regular icon,
// then the flipped-alignment one; a Traveller's holds unaligned, good, then evil.
describe('homebrewImage', () => {
	const pair = ['https://example.test/regular.png', 'https://example.test/flipped.png'];
	it('uses a single image for every alignment', () => {
		expect(homebrewImage('https://example.test/a.png', 'minion', 'good', true)).toBe(
			'https://example.test/a.png'
		);
	});
	it('uses the second image once the player is not the type’s usual alignment', () => {
		expect(homebrewImage(pair, 'townsfolk', 'good', false)).toBe(pair[0]);
		expect(homebrewImage(pair, 'townsfolk', 'evil', true)).toBe(pair[1]);
	});
	it('falls back to the first image when there is no second', () => {
		expect(homebrewImage([pair[0]], 'demon', 'good', true)).toBe(pair[0]);
	});
	it('picks a Traveller’s unaligned, good or evil image', () => {
		const three = ['u', 'g', 'e'].map((s) => `https://example.test/${s}.png`);
		expect(homebrewImage(three, 'traveller', undefined, false)).toBe(three[0]);
		expect(homebrewImage(three, 'traveller', 'good', false)).toBe(three[1]);
		expect(homebrewImage(three, 'traveller', 'evil', false)).toBe(three[2]);
	});
	it('gives nothing without an image', () => {
		expect(homebrewImage(undefined, 'minion', 'evil', false)).toBeUndefined();
		expect(homebrewImage([], 'minion', 'evil', false)).toBeUndefined();
		expect(homebrewImage('', 'minion', 'evil', false)).toBeUndefined();
	});
});

describe('genericIcons', () => {
	it('names TPI’s generic icon for each type', () => {
		expect(genericIcons('minion')).toEqual({
			good: 'generic/minion_g.webp',
			evil: 'generic/minion_e.webp'
		});
		expect(genericIcons('fabled')).toEqual({ unaligned: 'generic/fabled.webp' });
	});
});

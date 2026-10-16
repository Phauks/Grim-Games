import { describe, expect, it } from 'vitest';
import type { Character } from '#lib/core/data/index.ts';
import { iconUrls } from './keep-offline.ts';

const character = (id: string, type: Character['type'], edition?: string) =>
	({ id, type, edition }) as Character;

describe('iconUrls', () => {
	it('lists good and evil icons, and the unaligned one for Travellers', () => {
		expect(
			iconUrls([character('imp', 'demon', 'tb'), character('thief', 'traveller', 'bmr')])
		).toEqual([
			'/data/icons/tb/imp_g.webp',
			'/data/icons/tb/imp_e.webp',
			'/data/icons/bmr/thief.webp',
			'/data/icons/bmr/thief_g.webp',
			'/data/icons/bmr/thief_e.webp'
		]);
	});

	it('skips homebrew characters, which bring their own image', () => {
		expect(iconUrls([character('mine', 'townsfolk')])).toEqual([]);
	});
});

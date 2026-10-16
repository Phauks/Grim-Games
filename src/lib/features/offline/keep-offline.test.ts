import { describe, expect, it } from 'vitest';
import type { Character } from '#lib/core/data/index.ts';
import { iconUrls } from './keep-offline.ts';

const character = (
	id: string,
	type: Character['type'],
	edition?: string,
	image?: Character['image']
) => ({ id, type, edition, image }) as Character;

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

	it("lists every web image a homebrew character brings, the evil side's too", () => {
		expect(
			iconUrls([
				character('mine', 'townsfolk', undefined, [
					'https://example.com/mine.png',
					'https://example.com/mine-evil.png'
				]),
				character('yours', 'minion', undefined, 'https://example.com/yours.png')
			])
		).toEqual([
			'https://example.com/mine.png',
			'https://example.com/mine-evil.png',
			'https://example.com/yours.png'
		]);
	});

	it('skips homebrew characters with no image or an inline data: image', () => {
		expect(
			iconUrls([
				character('mine', 'townsfolk'),
				character('yours', 'townsfolk', undefined, 'data:image/png;base64,AAAA')
			])
		).toEqual([]);
	});
});

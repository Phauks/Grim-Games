import type { Character } from './types.ts';

/**
 * Character icon files synced from botc-release (`resources/characters/<edition>/`) into
 * `static/data/icons/<edition>/`. TPI's naming: `<id>_g.webp` is the good icon,
 * `<id>_e.webp` the evil one, and `<id>.webp` the unaligned icon that Travellers, Fabled
 * and Loric have.
 */
export interface CharacterIcons {
	good?: string;
	evil?: string;
	unaligned?: string;
}

/** URL path of the synced icons folder, as served from `static/`. */
export const ICONS_PATH = '/data/icons';

/**
 * Icon paths for an official character, relative to `ICONS_PATH`. Undefined for a
 * character without an edition (homebrew characters bring their own `image`).
 */
export function characterIcons(character: Character): CharacterIcons | undefined {
	const { edition, id, type } = character;
	if (!edition) return undefined;
	const base = `${edition}/${id}`;
	switch (type) {
		case 'fabled':
		case 'loric':
			return { unaligned: `${base}.webp` };
		case 'traveller':
			return { unaligned: `${base}.webp`, good: `${base}_g.webp`, evil: `${base}_e.webp` };
		default:
			return { good: `${base}_g.webp`, evil: `${base}_e.webp` };
	}
}

/**
 * TPI's generic icon for a character type (`resources/characters/generic/`), relative to
 * `ICONS_PATH`: the face a homebrew character without an image of its own gets.
 */
export function genericIcons(type: Character['type']): CharacterIcons {
	const base = `generic/${type}`;
	switch (type) {
		case 'fabled':
		case 'loric':
			return { unaligned: `${base}.webp` };
		case 'traveller':
			return { unaligned: `${base}.webp`, good: `${base}_g.webp`, evil: `${base}_e.webp` };
		default:
			return { good: `${base}_g.webp`, evil: `${base}_e.webp` };
	}
}

/**
 * Which of a homebrew character's own images to show, following TPI's script schema
 * (script-schema.json, `image`): a list holds the character's regular icon, then its
 * flipped-alignment icon; a Traveller's holds unaligned, good, then evil. `flipped` is true
 * when the player's alignment is not the type's usual one. Missing entries fall back to the
 * first image.
 */
export function homebrewImage(
	image: string | readonly string[] | undefined,
	type: Character['type'],
	alignment: 'good' | 'evil' | undefined,
	flipped: boolean
): string | undefined {
	if (image === undefined || typeof image === 'string') return image || undefined;
	const pick =
		type === 'traveller'
			? alignment === 'good'
				? image[1]
				: alignment === 'evil'
					? image[2]
					: image[0]
			: flipped
				? image[1]
				: image[0];
	return pick || image[0] || undefined;
}

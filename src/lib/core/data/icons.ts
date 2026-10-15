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

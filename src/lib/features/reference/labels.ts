import type { CharacterType } from '#lib/core/data/types.ts';

/** Group headings, in the game's own words. */
export const TYPE_PLURALS: Record<CharacterType, string> = {
	townsfolk: 'Townsfolk',
	outsider: 'Outsiders',
	minion: 'Minions',
	demon: 'Demons',
	traveller: 'Travellers',
	fabled: 'Fabled',
	loric: 'Loric'
};

export const TYPE_LABELS: Record<CharacterType, string> = {
	townsfolk: 'Townsfolk',
	outsider: 'Outsider',
	minion: 'Minion',
	demon: 'Demon',
	traveller: 'Traveller',
	fabled: 'Fabled',
	loric: 'Loric'
};

/** TPI's edition ids as shown to people; unknown ids are shown as they are. */
export const EDITION_LABELS: Record<string, string> = {
	tb: 'Trouble Brewing',
	bmr: 'Bad Moon Rising',
	snv: 'Sects & Violets',
	carousel: 'Carousel (experimental)',
	fabled: 'Fabled',
	loric: 'Loric'
};

import type { Snippet } from 'svelte';

/**
 * The looks a character takes (Trevor, 2026-11-02: "at each call location, allow them to
 * denote a certain generic type, which can be set in the component"). Each template is a
 * set of defaults for `CharacterPiece.svelte`; a call site picks one and may still override any
 * part. Adding a look is a new entry here, not a new component.
 */

/**
 * How the character is drawn: its icon in a ring beside a band, a pill inside a line, or
 * the icon alone where a name has no room (a mark on a rim, a jinx partner on a band).
 */
export type CharacterShape = 'ring' | 'pill' | 'icon';

export interface CharacterTemplate {
	shape: CharacterShape;
	/** The ability: under the band on a ring, under the bar on an entry. */
	ability: boolean;
	/** Runs the width it is given; otherwise only as wide as it needs. */
	fullWidth: boolean;
	/** Text under it is indented, as a heading's body (the entry). */
	entry: boolean;
}

export const CHARACTER_TEMPLATES = {
	/** The script's look: ring, band, ability (script sheets, the picker, the day's rows). */
	row: { shape: 'ring', ability: true, fullWidth: true, entry: false },
	/** The row with its ability turned off, name on the band (bluff lists, info tokens). */
	name: { shape: 'ring', ability: false, fullWidth: true, entry: false },
	/** A character named in a line of text, in general or with its player. */
	badge: { shape: 'pill', ability: false, fullWidth: false, entry: false },
	/** The badge across its space with text under it (announcements, notes, a rule). */
	entry: { shape: 'pill', ability: false, fullWidth: true, entry: true },
	/** The icon alone, sized by its host: a mark, a jinx partner, an illustration. */
	icon: { shape: 'icon', ability: false, fullWidth: false, entry: false }
} as const satisfies Record<string, CharacterTemplate>;

export type CharacterTemplateName = keyof typeof CHARACTER_TEMPLATES;

export const CHARACTER_TEMPLATE_NAMES = Object.keys(CHARACTER_TEMPLATES) as CharacterTemplateName[];

/** A template with a call site's overrides on top. */
export function resolveTemplate(
	name: CharacterTemplateName,
	overrides: Partial<Pick<CharacterTemplate, 'ability' | 'fullWidth'>>
): CharacterTemplate {
	const base: CharacterTemplate = CHARACTER_TEMPLATES[name];
	return {
		...base,
		// A pill in a line of text has no room for an ability; a ring or an entry does.
		ability: base.shape === 'ring' || base.entry ? (overrides.ability ?? base.ability) : false,
		fullWidth: overrides.fullWidth ?? base.fullWidth
	};
}

/**
 * A night step that isn't a character's (Dusk, Dawn, Minion info, Demon info) drawn as a
 * character's row: its picture in the ring, its name on the band (Trevor, 2026-11-03: "a
 * variant of the character info").
 */
export interface RowMarker {
	name: string;
	/** The ring and band's colour: `evil` for the evil team's steps, otherwise `neutral`. */
	team: 'evil' | 'neutral';
	picture: Snippet;
	/** The ring opens what the step is (the Glossary), named by `infoLabel`. */
	info?: () => void;
	infoLabel?: string;
}

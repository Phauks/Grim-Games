/**
 * The looks a character takes (Trevor, 2026-11-02: "at each call location, allow them to
 * denote a certain generic type, which can be set in the component"). Each template is a
 * set of defaults for `Character.svelte`; a call site picks one and may still override any
 * part. Adding a look is a new entry here, not a new component.
 */

/** How the character is drawn: its icon in a ring beside a band, or a pill inside a line. */
export type CharacterShape = 'ring' | 'pill';

export interface CharacterTemplate {
	shape: CharacterShape;
	/** The ability under the band (ring only). */
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
	entry: { shape: 'pill', ability: false, fullWidth: true, entry: true }
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
		// A pill has no room for an ability: it is a row's part.
		ability: base.shape === 'ring' ? (overrides.ability ?? base.ability) : false,
		fullWidth: overrides.fullWidth ?? base.fullWidth
	};
}

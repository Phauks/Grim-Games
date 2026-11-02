/**
 * The pieces the game mode and special rule guides are written with (format-guide.ts): the
 * guide's own shapes, the fields every part has, and the format's revision.
 */
import type { ModePart, RuleOnlyPart } from './types.ts';

/**
 * The rolling revision of the format while it is developed (Trevor, 2026-10-18): it goes up
 * with every change to the format, however small. A numbered version replaces it at launch.
 * A file may say which revision it was written for in `revision`; it is read either way.
 */
export const GAME_MODE_REVISION = 15;

export interface GuideField {
	name: string;
	/** How the value is written, e.g. "text", "true or false", "list of character ids". */
	type: string;
	required: boolean;
	/** What it means, and what happens when it is left out. */
	about: string;
	/** The values it may take, when it is one of a few. */
	values?: readonly string[];
}

export interface GuideKind {
	kind: string;
	about: string;
	fields: GuideField[];
}

export interface GuidePart {
	part: ModePart | RuleOnlyPart;
	/** One object, or a list of them. */
	list: boolean;
	about: string;
	/** Fields every kind of this part has (besides `cite` and `instructions`, which every part has). */
	fields: GuideField[];
	kinds: GuideKind[];
}

export const CITE: GuideField = {
	name: 'cite',
	type: 'https link',
	required: false,
	about: 'The page this part comes from, when it is not the mode’s first source.'
};

/** Required, from revision 8, on a part the app doesn't run (validate.ts). */
export const INSTRUCTIONS: GuideField = {
	name: 'instructions',
	type: 'text',
	required: false,
	about:
		'What the Storyteller does for this part. Required on a part Inspect shows as run by the Storyteller, so the file alone says what the game needs.'
};

export const IDS = 'list of character ids';
export const SEATED = ['townsfolk', 'outsider', 'minion', 'demon'] as const;
export const TYPES = [...SEATED, 'traveller', 'fabled', 'loric'] as const;
export const counts = (about: string): GuideField[] =>
	SEATED.map((type) => ({ name: type, type: 'whole number', required: false, about }));

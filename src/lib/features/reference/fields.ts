/**
 * The one list of what the Character Lab's table shows about a character: one column
 * each, rendered by `FieldValue.svelte`. The table is the page's only view (Trevor,
 * 2026-10-19: "remove card mode"); `coverage.ts` maps every piece of character data to the
 * column that shows it, so nothing can drop out of the table unnoticed.
 */
import { t } from '#lib/i18n/locale.svelte.ts';

export const FIELD_IDS = [
	'token',
	'name',
	'type',
	'edition',
	'icons',
	'alignment',
	'setup',
	'prep',
	'ability',
	'flavor',
	'tokens',
	'special',
	'cards',
	'firstNight',
	'otherNight',
	'jinxes',
	'preDay',
	'problems'
] as const;
export type FieldId = (typeof FIELD_IDS)[number];
/** A table column: one field. */
export type TableKey = FieldId;

export interface ReferenceField {
	id: FieldId;
	/** In the current language. */
	readonly label: string;
	/** Long content: the table keeps the default token size in these cells. */
	long?: boolean;
}

const FIELDS: readonly Omit<ReferenceField, 'label'>[] = [
	{ id: 'token' },
	{ id: 'name' },
	{ id: 'type' },
	{ id: 'edition' },
	// Every icon the character has (good, evil, unaligned); the token shows only one.
	{ id: 'icons' },
	{ id: 'alignment' },
	{ id: 'setup' },
	/** Pre-game preparation between the draw and the first night (`setupPrep`). */
	{ id: 'prep', long: true },
	{ id: 'ability', long: true },
	/** TPI's flavour text, the quote under the ability on the character sheet. */
	{ id: 'flavor', long: true },
	{ id: 'tokens' },
	{ id: 'special' },
	/** Info cards that belong to the character, e.g. the Mezepheles's secret word. */
	{ id: 'cards' },
	{ id: 'firstNight', long: true },
	{ id: 'otherNight', long: true },
	{ id: 'jinxes', long: true },
	{ id: 'preDay', long: true },
	{ id: 'problems', long: true }
];

/** Each field with its label read from the catalog when used, so it follows the language. */
export const REFERENCE_FIELDS: readonly ReferenceField[] = FIELDS.map((field) => ({
	...field,
	get label() {
		return t(`reference.field.${field.id}` as const);
	}
}));

/** Fields the table view renders, one column each, in list order. */
export function tableFieldIds(): FieldId[] {
	return REFERENCE_FIELDS.map((f) => f.id);
}

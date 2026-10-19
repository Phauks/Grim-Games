/**
 * The one list of what the Character reference table shows about a character: one column
 * each, rendered by `FieldValue.svelte`. The table is the page's only view (Trevor,
 * 2026-10-19: "remove card mode"); `coverage.ts` maps every piece of character data to the
 * column that shows it, so nothing can drop out of the table unnoticed.
 */
import type { TableColumn } from '#lib/core/rules/reference-table.ts';
import type { PlainMessageKey } from '#lib/i18n/catalog.ts';
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

/** How a table column filters. */
export type FilterKind = 'text' | 'types' | 'editions' | 'alignment' | 'presence';

export interface ReferenceField {
	id: FieldId;
	/** In the current language. */
	readonly label: string;
	/** Long content: the table keeps the default token size in these cells. */
	long?: boolean;
	/** Table sort column (core `reference-table.ts`), when the field sorts. */
	sort?: TableColumn;
	/** Table filter, when the field filters. */
	filter?: FilterKind;
}

const FIELDS: readonly Omit<ReferenceField, 'label'>[] = [
	{ id: 'token' },
	{ id: 'name', sort: 'name', filter: 'text' },
	{ id: 'type', sort: 'type', filter: 'types' },
	{ id: 'edition', sort: 'edition', filter: 'editions' },
	// Every icon the character has (good, evil, unaligned); the token shows only one.
	{ id: 'icons' },
	{
		id: 'alignment',
		sort: 'alignment',
		filter: 'alignment'
	},
	{ id: 'setup', sort: 'setup', filter: 'presence' },
	/** Pre-game preparation between the draw and the first night (`setupPrep`). */
	{ id: 'prep', long: true },
	{ id: 'ability', long: true },
	/** TPI's flavour text, the quote under the ability on the character sheet. */
	{ id: 'flavor', long: true },
	{ id: 'tokens', sort: 'tokens', filter: 'presence' },
	{ id: 'special' },
	/** Info cards that belong to the character, e.g. the Mezepheles's secret word. */
	{ id: 'cards' },
	{
		id: 'firstNight',
		long: true,
		sort: 'firstNight',
		filter: 'presence'
	},
	{
		id: 'otherNight',
		long: true,
		sort: 'otherNight',
		filter: 'presence'
	},
	{ id: 'jinxes', long: true, sort: 'jinxes', filter: 'presence' },
	{
		id: 'preDay',
		long: true,
		sort: 'preDay',
		filter: 'presence'
	},
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

export const fieldById = (id: FieldId): ReferenceField =>
	REFERENCE_FIELDS.find((f) => f.id === id)!;

/** Labels for the presence filter, per field. */
const PRESENCE_KEYS: Partial<Record<FieldId, { yes: PlainMessageKey; no: PlainMessageKey }>> = {
	firstNight: { yes: 'reference.presence.wakes', no: 'reference.presence.notWakes' },
	otherNight: { yes: 'reference.presence.wakes', no: 'reference.presence.notWakes' },
	tokens: { yes: 'reference.presence.tokens', no: 'common.none' },
	setup: { yes: 'reference.presence.setup', no: 'common.none' },
	jinxes: { yes: 'reference.presence.jinxes', no: 'common.none' },
	preDay: { yes: 'reference.presence.preDay', no: 'common.none' }
};
export const PRESENCE_LABELS: Partial<
	Record<FieldId, { readonly yes: string; readonly no: string }>
> = Object.fromEntries(
	Object.entries(PRESENCE_KEYS).map(([id, keys]) => [
		id,
		{
			get yes() {
				return t(keys.yes);
			},
			get no() {
				return t(keys.no);
			}
		}
	])
);

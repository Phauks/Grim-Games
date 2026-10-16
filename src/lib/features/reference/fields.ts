/**
 * The one list of what the Character reference shows about a character. The card view and
 * the table view both render from `REFERENCE_FIELDS` (through `FieldValue.svelte`), so the
 * two views always carry the same information (Trevor: "card and table do not have
 * information parity").
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
	'tokens',
	'special',
	'cards',
	'firstNight',
	'otherNight',
	'jinxes',
	'preDay',
	'problems',
	'links'
] as const;
export type FieldId = (typeof FIELD_IDS)[number];

/** How a table column filters. */
export type FilterKind = 'text' | 'types' | 'alignment' | 'presence';

export interface ReferenceField {
	id: FieldId;
	/** In the current language. */
	readonly label: string;
	/** Where the card shows it: in its header, on one line with its label, or as a block. */
	card: 'header' | 'inline' | 'block';
	/** Long content: the table keeps the default token size in these cells. */
	long?: boolean;
	/** Cards only: the table leaves it out. */
	cardOnly?: boolean;
	/** Table sort column (core `reference-table.ts`), when the field sorts. */
	sort?: TableColumn;
	/** Table filter, when the field filters. */
	filter?: FilterKind;
}

const FIELDS: readonly Omit<ReferenceField, 'label'>[] = [
	{ id: 'token', card: 'header' },
	{ id: 'name', card: 'header', sort: 'name', filter: 'text' },
	{ id: 'type', card: 'header', sort: 'type', filter: 'types' },
	{ id: 'edition', card: 'header', sort: 'edition' },
	// The table's token column already shows the icon, so it spends no space on the icon pair
	// (Trevor, 2026-10-16).
	{ id: 'icons', card: 'header', cardOnly: true },
	{
		id: 'alignment',
		card: 'inline',
		sort: 'alignment',
		filter: 'alignment'
	},
	{ id: 'setup', card: 'inline', sort: 'setup', filter: 'presence' },
	/** Pre-game preparation between the draw and the first night (`setupPrep`). */
	{ id: 'prep', card: 'inline', long: true },
	{ id: 'ability', card: 'block', long: true },
	{ id: 'tokens', card: 'inline', sort: 'tokens', filter: 'presence' },
	{ id: 'special', card: 'inline' },
	/** Info cards that belong to the character, e.g. the Mezepheles's secret word. */
	{ id: 'cards', card: 'inline' },
	{
		id: 'firstNight',
		card: 'inline',
		long: true,
		sort: 'firstNight',
		filter: 'presence'
	},
	{
		id: 'otherNight',
		card: 'inline',
		long: true,
		sort: 'otherNight',
		filter: 'presence'
	},
	{ id: 'jinxes', card: 'inline', long: true, sort: 'jinxes', filter: 'presence' },
	{
		id: 'preDay',
		card: 'inline',
		long: true,
		sort: 'preDay',
		filter: 'presence'
	},
	{ id: 'problems', card: 'inline', long: true },
	// At the top of a card and under the name in the table (Trevor, 2026-10-16).
	{ id: 'links', card: 'header', cardOnly: true }
];

/** Each field with its label read from the catalog when used, so it follows the language. */
export const REFERENCE_FIELDS: readonly ReferenceField[] = FIELDS.map((field) => ({
	...field,
	get label() {
		return t(`reference.field.${field.id}` as const);
	}
}));

/** Fields the card view renders: every field, header ones first. */
export function cardFieldIds(): FieldId[] {
	const header = REFERENCE_FIELDS.filter((f) => f.card === 'header');
	const body = REFERENCE_FIELDS.filter((f) => f.card !== 'header');
	return [...header, ...body].map((f) => f.id);
}

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

/**
 * The one list of what the Character reference shows about a character. The card view and
 * the table view both render from `REFERENCE_FIELDS` (through `FieldValue.svelte`), so the
 * two views always carry the same information (Trevor: "card and table do not have
 * information parity").
 */
import type { TableColumn } from '#lib/core/rules/reference-table.ts';

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
	label: string;
	/** Where the card shows it: in its header, on one line with its label, or as a block. */
	card: 'header' | 'inline' | 'block';
	/** Long content: clamped in a table cell, with the whole value in the details dialog. */
	long?: boolean;
	/** Table sort column (core `reference-table.ts`), when the field sorts. */
	sort?: TableColumn;
	/** Table filter, when the field filters. */
	filter?: FilterKind;
}

export const REFERENCE_FIELDS: readonly ReferenceField[] = [
	{ id: 'token', label: 'Token', card: 'header' },
	{ id: 'name', label: 'Name', card: 'header', sort: 'name', filter: 'text' },
	{ id: 'type', label: 'Type', card: 'header', sort: 'type', filter: 'types' },
	{ id: 'edition', label: 'Edition', card: 'header', sort: 'edition' },
	{ id: 'icons', label: 'Icons', card: 'header' },
	{
		id: 'alignment',
		label: 'Starting alignment',
		card: 'inline',
		sort: 'alignment',
		filter: 'alignment'
	},
	{ id: 'setup', label: 'Setup', card: 'inline', sort: 'setup', filter: 'presence' },
	/** Pre-game preparation between the draw and the first night (`setupPrep`). */
	{ id: 'prep', label: 'Prep', card: 'inline', long: true },
	{ id: 'ability', label: 'Ability', card: 'block', long: true },
	{ id: 'tokens', label: 'Tokens', card: 'inline', sort: 'tokens', filter: 'presence' },
	{ id: 'special', label: 'Special', card: 'inline' },
	{
		id: 'firstNight',
		label: 'First night',
		card: 'inline',
		long: true,
		sort: 'firstNight',
		filter: 'presence'
	},
	{
		id: 'otherNight',
		label: 'Other nights',
		card: 'inline',
		long: true,
		sort: 'otherNight',
		filter: 'presence'
	},
	{ id: 'jinxes', label: 'Jinxes', card: 'inline', long: true, sort: 'jinxes', filter: 'presence' },
	{
		id: 'preDay',
		label: 'Pre-day',
		card: 'inline',
		long: true,
		sort: 'preDay',
		filter: 'presence'
	},
	{ id: 'problems', label: 'Possible problems', card: 'inline', long: true },
	{ id: 'links', label: 'Links', card: 'block' }
];

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
export const PRESENCE_LABELS: Partial<Record<FieldId, { yes: string; no: string }>> = {
	firstNight: { yes: 'Wakes', no: 'Doesn’t wake' },
	otherNight: { yes: 'Wakes', no: 'Doesn’t wake' },
	tokens: { yes: 'Has tokens', no: 'None' },
	setup: { yes: 'Changes setup', no: 'None' },
	jinxes: { yes: 'Has jinxes', no: 'None' },
	preDay: { yes: 'Has reminders', no: 'None' }
};

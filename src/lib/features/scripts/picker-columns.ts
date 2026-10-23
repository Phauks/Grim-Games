/**
 * The Scripts page table's columns (`ScriptPicker.svelte`); its rows are in `picker-rows.ts`.
 */
import { t } from '#lib/i18n/locale.svelte.ts';
import type { DataColumn } from '#lib/ui/table/DataTable.svelte';
import { filterCount } from './botcscripts-api.ts';
import type { SortColumn } from './picker-rows.ts';
import type { ScriptListing } from './script-providers.ts';
import type { BotcFilters } from './script-search.svelte.ts';

/**
 * Name, Author, Source, Type and a character count for every source; Likes and No. while
 * BotC Scripts is on, the one source that has them (Trevor, 2026-10-17). Source, Chars, Likes
 * and No. give way on phones (Likes and No. already on a tablet), and their filters move
 * into the Name header. On phones each row is two lines: the name across the whole row, then
 * Author and Type under it (Trevor, 2026-10-19).
 */
export function pickerColumns(
	searchingBotc: boolean,
	botcFilters: BotcFilters
): DataColumn<SortColumn, ScriptListing>[] {
	const characterFilters = filterCount({ ...botcFilters, term: '', type: '', author: '' });
	return [
		{
			id: 'name',
			label: t('scripts.column.name'),
			sortable: true,
			flush: true,
			noFilter: 'The search box above the table searches names.'
		},
		{
			id: 'author',
			label: t('scripts.column.author'),
			sortable: true,
			// Room for the label, its sort arrows and its filter on one line, even on a phone.
			width: 'max(22%, 9.5rem)',
			secondLine: true,
			filterable: true,
			filtered: botcFilters.author !== ''
		},
		{
			id: 'source',
			label: t('scripts.column.source'),
			sortable: true,
			// Gives way on phones like Chars; the details name the source.
			wide: true,
			width: '9rem',
			value: (l) => t(`scripts.sourceLabel.${l.row.source}`)
		},
		{
			id: 'kind',
			label: t('scripts.column.type'),
			sortable: true,
			// Label, sort arrows and filter side by side.
			width: '7rem',
			secondLine: true,
			filterable: true,
			filtered: botcFilters.type !== ''
		},
		{
			id: 'characters',
			label: t('scripts.column.characters'),
			sortable: true,
			align: 'end',
			wide: true,
			width: '8rem',
			filterable: true,
			filtered: characterFilters > 0
		},
		...(searchingBotc
			? ([
					{
						id: 'likes',
						label: t('scripts.column.likes'),
						sortable: true,
						wider: true,
						align: 'end',
						// Label, sort arrows and filter side by side.
						width: '7.5rem',
						value: (l) => l.row.likes ?? 0
					},
					{
						id: 'number',
						label: t('scripts.column.number'),
						sortable: true,
						wider: true,
						align: 'end',
						width: '6.5rem',
						value: (l) => l.row.number
					}
				] satisfies DataColumn<SortColumn, ScriptListing>[])
			: [])
	];
}

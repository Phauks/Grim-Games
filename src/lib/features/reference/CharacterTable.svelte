<script lang="ts">
	import type { Character } from '#lib/core/data/types.ts';
	import type { ReferenceEntry } from '#lib/core/rules/reference.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import DataTable, { type DataColumn } from '#lib/ui/table/DataTable.svelte';
	import FieldValue from './FieldValue.svelte';
	import { REFERENCE_FIELDS, type FieldId, type TableKey as Key } from './fields.ts';

	/**
	 * The Character Lab's core character, every field shown, with no sort, filters or column
	 * picker (plan M47, Trevor 2026-11-04: "remove all those useless table controls").
	 */
	interface Props {
		rows: readonly ReferenceEntry[];
		onExplain: (title: string, text: string, character?: Character) => void;
	}

	let { rows, onExplain }: Props = $props();

	/** Fixed widths (in --u): layout never depends on which rows are drawn, so nothing reflows. */
	const WIDTHS: Record<FieldId, number> = {
		token: 4,
		// Plain text: wide enough for the longest names (Deus ex Fiasco, Hell's Librarian).
		name: 13,
		type: 7,
		edition: 9,
		icons: 6.5,
		// "Starting alignment" on one line (Trevor, 2026-10-18).
		alignment: 14.5,
		setup: 11,
		prep: 18,
		ability: 18,
		flavor: 16,
		tokens: 12,
		special: 11,
		cards: 9,
		firstNight: 17,
		otherNight: 17,
		jinxes: 18,
		preDay: 19,
		problems: 15
	};

	const NO_FILTER = 'The lab shows only its core character.';

	const fieldColumns = $derived(
		REFERENCE_FIELDS.map((field): DataColumn<Key, ReferenceEntry> => ({
			id: field.id,
			label: field.label,
			width: `calc(${WIDTHS[field.id]} * var(--u))`,
			rowHeader: field.id === 'name',
			stackHead: field.id === 'token',
			noFilter: NO_FILTER
		}))
	);
	const columns = $derived(fieldColumns);

	const field = (id: Key) => REFERENCE_FIELDS.find((f) => f.id === id)!;
</script>

{#snippet cell(entry: ReferenceEntry, column: DataColumn<Key>)}
	{@const f = field(column.id)}
	<!-- Shown in full: rows are as tall as their longest field (Trevor, 2026-10-16). -->
	<div class="cell">
		<FieldValue field={f.id} {entry} {onExplain} tokenSize={f.long ? undefined : 40} />
	</div>
{/snippet}

<!--
	Wide screens get a real table. Narrow ones (phones, or large text) stack each row into a
	block of labelled fields, so the page never scrolls sideways (Trevor, 2026-10-16).
-->
<div class="table-view">
	<DataTable
		label="Characters"
		testid="character-table"
		{columns}
		{rows}
		key={(entry) => entry.character.id}
		rowLabel={(entry) => entry.character.name}
		{cell}
		narrow="stack"
		fit="content"
		resizeKey="reference"
		controls={false}
		lazy
		rowEstimate="calc(10 * var(--u))"
		rowAttrs={(entry) => ({
			// A link to one character (#witch, from a bug report) scrolls to its row.
			id: entry.character.id,
			'data-character': entry.character.id,
			'data-type': entry.character.type
		})}
		empty={t('reference.noMatch')}
	/>
</div>

<style>
	.table-view {
		font-size: 0.9rem;
	}

	/* Stacked rows: the value sits beside its label when there is room, else under it. */
	@container data-table (max-width: 40rem) {
		.cell {
			flex: 1 1 calc(8 * var(--u));
		}
		/* With no sort or filters, each stacked field is labelled on its row: no header row. */
		.table-view :global(thead) {
			display: none;
		}
	}
</style>

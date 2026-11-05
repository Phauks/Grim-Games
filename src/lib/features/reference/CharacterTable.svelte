<script lang="ts">
	import type { Character } from '#lib/core/data/types.ts';
	import type { ReferenceEntry } from '#lib/core/rules/reference.ts';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import DataTable, { type DataColumn } from '#lib/ui/table/DataTable.svelte';
	import FieldValue from './FieldValue.svelte';
	import { REFERENCE_FIELDS, type FieldId, type TableKey as Key } from './fields.ts';

	/** The Character Lab's Lock column (plan M45), set while the page holds the lab. */
	export interface TableLab {
		locked: readonly CharacterId[];
		onLock: (id: CharacterId, lock: boolean) => void;
	}

	/**
	 * The Character Lab's rows, every field shown, with no sort, filters or column picker (plan
	 * M47, Trevor 2026-11-04: "remove all those useless table controls").
	 */
	interface Props {
		rows: readonly ReferenceEntry[];
		onExplain: (title: string, text: string, character?: Character) => void;
		/** Told the rows as shown, in order. */
		onrows?: (rows: readonly ReferenceEntry[]) => void;
		lab?: TableLab;
	}

	let { rows, onExplain, onrows, lab }: Props = $props();

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

	const NO_FILTER = 'The lab lists only the selected characters and their jinx partners.';

	/** Lock, before the character's own columns, while the page holds the lab. */
	const labColumns = $derived.by((): DataColumn<Key, ReferenceEntry>[] => {
		if (!lab) return [];
		return [
			{
				id: 'lock',
				label: t('lab.lock'),
				width: 'calc(7 * var(--u))',
				fixed: true,
				stackHead: true,
				noFilter: NO_FILTER
			}
		];
	});

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
	const columns = $derived([...labColumns, ...fieldColumns]);

	const field = (id: Key) => REFERENCE_FIELDS.find((f) => f.id === id)!;
</script>

{#snippet cell(entry: ReferenceEntry, column: DataColumn<Key>)}
	{@const id = entry.character.id}
	{#if column.id === 'lock' && lab}
		{@const locked = lab.locked.includes(id)}
		<!-- Locks the character into every lab game (plan M45). -->
		<Chip
			pressed={locked}
			aria-label={t('lab.lockName', { character: entry.character.name })}
			onclick={() => lab.onLock(id, !locked)}>{t('lab.lock')}</Chip
		>
	{:else}
		{@const f = field(column.id)}
		<!-- Shown in full: rows are as tall as their longest field (Trevor, 2026-10-16). -->
		<div class="cell">
			<FieldValue field={f.id} {entry} {onExplain} tokenSize={f.long ? undefined : 40} />
		</div>
	{/if}
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
		{onrows}
		controls={false}
		lazy
		rowEstimate="calc(10 * var(--u))"
		rowAttrs={(entry) => ({
			// A link to one character (#witch, from a bug report) scrolls to its row.
			id: entry.character.id,
			'data-character': entry.character.id,
			'data-type': entry.character.type,
			'data-locked': lab?.locked.includes(entry.character.id) ? '' : undefined
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
	}
</style>

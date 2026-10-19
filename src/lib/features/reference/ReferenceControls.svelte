<script lang="ts">
	import type { ReferenceEntry } from '#lib/core/rules/reference.ts';
	import { activeFilterCount } from '#lib/core/rules/reference-table.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import type { ReferenceQuery } from './query.svelte.ts';
	import { referenceTable } from './table-state.svelte.ts';

	interface Props {
		entries: readonly ReferenceEntry[];
		query: ReferenceQuery;
	}

	let { entries, query }: Props = $props();

	const filters = $derived(
		activeFilterCount(referenceTable.current.filters) + Object.keys(query.columnFilters).length
	);
</script>

<!-- In the page's title row (Trevor, 2026-10-18): search, then the table's count. -->
<div class="controls">
	<!-- On a computer, "/" jumps to the search field and Esc clears it. -->
	<div class="search-line">
		<SearchField
			bind:value={query.search}
			label={t('reference.searchLabel')}
			placeholder={t('reference.searchPlaceholder')}
			shortcut
		/>
	</div>
	<div class="table-count">
		<p class="count" aria-live="polite" data-testid="table-count">
			{t('reference.tableCount', {
				shown: query.tableShown,
				total: entries.length,
				filters:
					filters === 0 ? t('reference.noFilters') : t('reference.filters', { count: filters })
			})}
		</p>
		<!-- Clearing filters deletes nothing, so it is the clear-X, not the trash can. -->
		<IconButton
			icon="close"
			label={t('reference.clearFilters')}
			disabled={filters === 0}
			onclick={() => {
				referenceTable.clearFilters();
				query.columnFilters = {};
			}}
		/>
	</div>
</div>

<style>
	/* Fills the actions area: the whole row under the title on a phone, the title's row on wider. */
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2) var(--space-3);
		width: 100%;
	}
	.search-line {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		/* The search stops at a readable width, and shrinks to the screen before widening it. */
		/* Small enough to share a tablet's title row with the count and Clear filters. */
		flex: 1 1 calc(12 * var(--u));
		max-width: calc(36 * var(--u));
		min-width: 0;
	}
	.search-line > :global(:first-child) {
		flex: 1;
		min-width: 0;
	}
	.table-count {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.count {
		margin: 0;
		font-size: 0.9rem;
		color: var(--on-surface-muted);
		white-space: nowrap;
	}
</style>

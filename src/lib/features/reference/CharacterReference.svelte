<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { groupByType, matchesReference, type ReferenceEntry } from '#lib/core/rules/reference.ts';
	import { activeFilterCount, tableRows } from '#lib/core/rules/reference-table.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import CharacterTable from './CharacterTable.svelte';
	import ViewToggle from './ViewToggle.svelte';
	import { TYPE_PLURALS } from './labels.ts';
	import ReferenceCard from './ReferenceCard.svelte';
	import { referenceTable } from './table-state.svelte.ts';
	import type { ReferenceView } from './view-mode.svelte.ts';

	interface Props {
		entries: readonly ReferenceEntry[];
		view: ReferenceView;
	}

	let { entries, view }: Props = $props();

	// One shared details overlay, so extra detail never expands a card or row inline.
	// `title` may hold the `character` slot (slots.ts), shown as `character`'s badge.
	let details = $state<{ title: string; text: string; character?: Character }>();
	let detailsOpen = $state(false);
	function explain(title: string, text: string, character?: Character) {
		details = { title, text, character };
		detailsOpen = true;
	}

	// Search is the one filter for cards; the table adds its own per-column filters.
	let search = $state('');
	const shown = $derived(entries.filter((e) => matchesReference(e, { search })));
	const groups = $derived(groupByType(shown));
	// The table's own column filters and sort apply on top of the search.
	const rows = $derived(view === 'table' ? tableRows(shown, referenceTable.current) : []);
	// The shared table also filters the columns Reference has no filter of its own for.
	let columnFilters = $state({});
	let tableShown = $state(0);
	const filters = $derived(
		activeFilterCount(referenceTable.current.filters) + Object.keys(columnFilters).length
	);
</script>

<div class="controls">
	<!-- On a computer, "/" jumps to the search field and Esc clears it. -->
	<div class="search-line">
		<SearchField
			bind:value={search}
			label={t('reference.searchLabel')}
			placeholder={t('reference.searchPlaceholder')}
			shortcut
		/>
		<ViewToggle />
	</div>
	{#if view === 'cards'}
		<p class="count" aria-live="polite">
			{t('reference.count', { shown: shown.length, count: entries.length })}
		</p>
	{:else}
		<!-- The table's count and Clear sit on the search line, not a line of their own. -->
		<div class="table-count">
			<p class="count" aria-live="polite" data-testid="table-count">
				{t('reference.tableCount', {
					shown: tableShown,
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
					columnFilters = {};
				}}
			/>
		</div>
	{/if}
</div>

{#if view === 'table'}
	<CharacterTable
		{rows}
		onExplain={explain}
		bind:columnFilters
		oncount={(count) => (tableShown = count)}
	/>
{:else}
	{#each groups as group (group.type)}
		<!-- Each character type folds away under its caret (Trevor, 2026-10-16); a search shows
		     every match. -->
		<div class="group">
			<Collapsible
				title={TYPE_PLURALS[group.type]}
				tone={group.type === 'townsfolk' || group.type === 'outsider'
					? 'good'
					: group.type === 'minion' || group.type === 'demon'
						? 'evil'
						: undefined}
				storageKey="reference:{group.type}"
				forceOpen={search.trim() !== ''}
			>
				{#snippet aside()}<span class="group-count">({group.entries.length})</span>{/snippet}
				<div class="cards">
					{#each group.entries as entry (entry.character.id)}
						<ReferenceCard {entry} onExplain={explain} />
					{/each}
				</div>
			</Collapsible>
		</div>
	{:else}
		<p class="empty">{t('reference.noMatch')}</p>
	{/each}
{/if}

<Dialog bind:open={detailsOpen} title={details?.title ?? ''}>
	{#snippet heading()}
		<Sentence text={details?.title ?? ''}
			>{#snippet fill()}{#if details?.character}<CharacterBadge
						characterId={details.character.id}
						character={details.character}
						inline
					/>{/if}{/snippet}</Sentence
		>
	{/snippet}
	{#if details}<p>{details.text}</p>{/if}
</Dialog>

<style>
	.controls {
		display: grid;
		/* minmax(0, …): the search field shrinks to the screen instead of widening the page. */
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-3);
		margin-bottom: var(--space-5);
	}
	/* On a wider screen the search field stops at a readable width, with the count beside it. */
	@media (min-width: 48rem) {
		.controls {
			grid-template-columns: minmax(0, calc(36 * var(--u))) auto;
			align-items: center;
		}
	}
	.search-line {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.search-line > :global(:first-child) {
		flex: 1;
		min-width: 0;
	}
	.table-count {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.count {
		margin: 0;
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
	.group {
		margin-bottom: var(--space-6);
	}
	.group-count {
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
	/* Long cards: one per row on a laptop or desktop, so each lays its fields out side by side
	   rather than in a tall stack (Trevor, 2026-10-16); two on the widest screens. */
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(36 * var(--u))), 1fr));
		gap: var(--space-3);
		align-items: start;
	}
	.empty {
		color: var(--on-surface-muted);
	}
</style>

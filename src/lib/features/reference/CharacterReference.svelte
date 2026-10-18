<script lang="ts">
	import { typeTone } from '#lib/core/data/character-type.ts';
	import type { Character } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { groupByType, matchesReference, type ReferenceEntry } from '#lib/core/rules/reference.ts';
	import { tableRows } from '#lib/core/rules/reference-table.ts';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import CharacterTable from './CharacterTable.svelte';
	import { TYPE_PLURALS } from './labels.ts';
	import type { ReferenceQuery } from './query.svelte.ts';
	import ReferenceCard from './ReferenceCard.svelte';
	import { referenceTable } from './table-state.svelte.ts';
	import type { ReferenceView } from './view-mode.svelte.ts';

	interface Props {
		entries: readonly ReferenceEntry[];
		view: ReferenceView;
		query: ReferenceQuery;
	}

	let { entries, view, query }: Props = $props();

	// One shared details overlay, so extra detail never expands a card or row inline.
	// `title` may hold the `character` slot (slots.ts), shown as `character`'s badge.
	let details = $state<{ title: string; text: string; character?: Character }>();
	let detailsOpen = $state(false);
	function explain(title: string, text: string, character?: Character) {
		details = { title, text, character };
		detailsOpen = true;
	}

	// Search is the one filter for cards; the table adds its own per-column filters. Both are
	// set by the controls in the page's title row (ReferenceControls).
	const shown = $derived(entries.filter((e) => matchesReference(e, { search: query.search })));
	const groups = $derived(groupByType(shown));
	// The table's own column filters and sort apply on top of the search.
	const rows = $derived(view === 'table' ? tableRows(shown, referenceTable.current) : []);
</script>

{#if view === 'table'}
	<CharacterTable
		{rows}
		onExplain={explain}
		bind:columnFilters={query.columnFilters}
		oncount={(count) => (query.tableShown = count)}
	/>
{:else}
	{#each groups as group (group.type)}
		<!-- Each character type folds away under its caret (Trevor, 2026-10-16); a search shows
		     every match. -->
		<div class="group">
			<Collapsible
				title={TYPE_PLURALS[group.type]}
				tone={typeTone(group.type)}
				storageKey="reference:{group.type}"
				forceOpen={query.search.trim() !== ''}
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

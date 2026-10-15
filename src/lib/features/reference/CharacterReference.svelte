<script lang="ts">
	import { groupByType, matchesReference, type ReferenceEntry } from '#lib/core/rules/reference.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import CharacterTable from './CharacterTable.svelte';
	import FieldValue from './FieldValue.svelte';
	import { fieldById, type FieldId } from './fields.ts';
	import { TYPE_PLURALS } from './labels.ts';
	import ReferenceCard from './ReferenceCard.svelte';
	import type { ReferenceView } from './view-mode.svelte.ts';

	interface Props {
		entries: readonly ReferenceEntry[];
		view: ReferenceView;
	}

	let { entries, view }: Props = $props();

	// One shared details overlay, so extra detail never expands a card or row inline.
	let details = $state<
		{ title: string; text: string } | { title: string; entry: ReferenceEntry; field: FieldId }
	>();
	let detailsOpen = $state(false);
	function explain(title: string, text: string) {
		details = { title, text };
		detailsOpen = true;
	}
	function showField(entry: ReferenceEntry, field: FieldId) {
		details = { title: `${entry.character.name}: ${fieldById(field).label}`, entry, field };
		detailsOpen = true;
	}

	// Search is the one filter for cards; the table adds its own per-column filters.
	let search = $state('');
	const shown = $derived(entries.filter((e) => matchesReference(e, { search })));
	const groups = $derived(groupByType(shown));
</script>

<div class="controls">
	<label class="search">
		<span class="visually-hidden">Search characters</span>
		<Icon name="search" />
		<input
			type="search"
			placeholder="Search name, ability or reminder"
			autocomplete="off"
			bind:value={search}
		/>
	</label>
	{#if view === 'cards'}
		<p class="count" aria-live="polite">{shown.length} of {entries.length} characters</p>
	{/if}
</div>

{#if view === 'table'}
	<CharacterTable entries={shown} onExplain={explain} onShowField={showField} />
{:else}
	{#each groups as group (group.type)}
		<section class="group" aria-labelledby="group-{group.type}">
			<h2 id="group-{group.type}">
				{TYPE_PLURALS[group.type]} <span>({group.entries.length})</span>
			</h2>
			<div class="cards">
				{#each group.entries as entry (entry.character.id)}
					<ReferenceCard {entry} onExplain={explain} />
				{/each}
			</div>
		</section>
	{:else}
		<p class="empty">No characters match.</p>
	{/each}
{/if}

<Dialog bind:open={detailsOpen} title={details?.title ?? ''}>
	{#if details && 'text' in details}
		<p>{details.text}</p>
	{:else if details}
		<div class="details">
			<FieldValue field={details.field} entry={details.entry} onExplain={explain} />
		</div>
	{/if}
</Dialog>

<style>
	.controls {
		display: grid;
		gap: var(--space-3);
		margin-bottom: var(--space-5);
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: var(--card-border);
		border-radius: var(--radius-full);
		background: var(--card-background);
		color: var(--on-surface-muted);
	}
	.search:focus-within {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	input {
		flex: 1;
		min-width: 0;
		min-height: var(--tap-target);
		border: 0;
		outline: none;
		background: none;
		color: var(--on-surface);
		/* 16px or more stops iOS zooming into the field. */
		font: inherit;
		font-size: max(1rem, 16px);
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.count {
		margin: 0;
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
	.details {
		line-height: 1.5;
	}
	.group {
		margin-bottom: var(--space-6);
	}
	h2 {
		margin: 0 0 var(--space-3);
		font-size: 1.3rem;
	}
	h2 span {
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
	.cards {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-3);
		align-items: start;
	}
	@media (min-width: 40rem) {
		.cards {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (min-width: 80rem) {
		.cards {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	.empty {
		color: var(--on-surface-muted);
	}
</style>

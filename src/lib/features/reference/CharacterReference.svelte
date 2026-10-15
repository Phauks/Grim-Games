<script lang="ts">
	import { CHARACTER_TYPES, type CharacterType } from '#lib/core/data/types.ts';
	import {
		groupByType,
		matchesReference,
		REFERENCE_FILTER_LABELS,
		REFERENCE_FILTERS,
		type ReferenceEntry,
		type ReferenceFilter
	} from '#lib/core/rules/reference.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { TYPE_PLURALS } from './labels.ts';
	import ReferenceCard from './ReferenceCard.svelte';

	interface Props {
		entries: readonly ReferenceEntry[];
	}

	let { entries }: Props = $props();

	let search = $state('');
	let types = $state<CharacterType[]>([]);
	let filters = $state<ReferenceFilter[]>([]);

	const shown = $derived(entries.filter((e) => matchesReference(e, { search, types, filters })));
	const groups = $derived(groupByType(shown));

	function toggle<T>(list: T[], value: T): T[] {
		return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
	}
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
	<div class="chips" role="group" aria-label="Character types">
		{#each CHARACTER_TYPES as type (type)}
			<button
				type="button"
				class="chip"
				aria-pressed={types.includes(type)}
				onclick={() => (types = toggle(types, type))}>{TYPE_PLURALS[type]}</button
			>
		{/each}
	</div>
	<div class="chips" role="group" aria-label="Filters">
		{#each REFERENCE_FILTERS as filter (filter)}
			<button
				type="button"
				class="chip"
				aria-pressed={filters.includes(filter)}
				onclick={() => (filters = toggle(filters, filter))}
				>{REFERENCE_FILTER_LABELS[filter]}</button
			>
		{/each}
	</div>
	<p class="count" aria-live="polite">
		{shown.length} of {entries.length} characters
	</p>
</div>

{#each groups as group (group.type)}
	<section class="group" aria-labelledby="group-{group.type}">
		<h2 id="group-{group.type}">
			{TYPE_PLURALS[group.type]} <span>({group.entries.length})</span>
		</h2>
		<div class="cards">
			{#each group.entries as entry (entry.character.id)}
				<ReferenceCard {entry} />
			{/each}
		</div>
	</section>
{:else}
	<p class="empty">No characters match.</p>
{/each}

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
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.chip {
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-full);
		background: var(--choice-background);
		box-shadow: inset 0 0 0 1px var(--border);
		color: var(--choice-color);
		font: inherit;
		font-size: 0.9rem;
		cursor: pointer;
	}
	.chip[aria-pressed='true'] {
		background: var(--choice-selected-background);
		box-shadow: inset 0 0 0 2px var(--choice-selected-border);
	}
	.chip:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.count {
		margin: 0;
		font-size: 0.9rem;
		color: var(--on-surface-muted);
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
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 26rem), 1fr));
		gap: var(--space-4);
		align-items: start;
	}
	.empty {
		color: var(--on-surface-muted);
	}
</style>

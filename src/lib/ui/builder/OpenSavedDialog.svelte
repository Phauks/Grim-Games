<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';

	/**
	 * A builder's "Open a saved …" list: tap one to open it on the builder. With `search`, a
	 * search box sits above the list, for lists too long to scroll through (the Script
	 * builder's Homebrew Wiki collections, Trevor 2026-10-18).
	 */
	interface Props {
		open?: boolean;
		title: string;
		items: readonly T[];
		key: (item: T) => string;
		/** The row's content. */
		row: Snippet<[T]>;
		onChoose: (item: T) => void;
		search?: { label: string; matches: (item: T, words: readonly string[]) => boolean };
		testid?: string;
	}

	let {
		open = $bindable(false),
		title,
		items,
		key,
		row,
		onChoose,
		search,
		testid
	}: Props = $props();
	let query = $state('');
	const words = $derived(query.toLowerCase().split(/\s+/).filter(Boolean));
	const shown = $derived(
		search && words.length ? items.filter((item) => search.matches(item, words)) : items
	);
</script>

<Dialog bind:open {title}>
	{#if search}<div class="search"><SearchField label={search.label} bind:value={query} /></div>{/if}
	<ul class="saved" data-testid={testid}>
		{#each shown as item (key(item))}
			<li>
				<button type="button" onclick={() => onChoose(item)}>{@render row(item)}</button>
			</li>
		{:else}
			<li>{t('common.none')}</li>
		{/each}
	</ul>
	{#snippet actions()}
		<ModalActions onCancel={() => (open = false)} />
	{/snippet}
</Dialog>

<style>
	.search {
		margin-top: var(--space-3);
	}
	.saved {
		display: grid;
		gap: var(--space-1);
		margin: var(--space-3) 0;
		padding: 0;
		list-style: none;
	}
	.saved button {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 0;
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	@media (hover: hover) {
		.saved button:hover {
			background: var(--surface-selected);
		}
	}
</style>

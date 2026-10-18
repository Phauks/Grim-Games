<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';

	/** A builder's "Open a saved …" list: tap one to open it on the builder. */
	interface Props {
		open?: boolean;
		title: string;
		items: readonly T[];
		key: (item: T) => string;
		/** The row's content. */
		row: Snippet<[T]>;
		onChoose: (item: T) => void;
		testid?: string;
	}

	let { open = $bindable(false), title, items, key, row, onChoose, testid }: Props = $props();
</script>

<Dialog bind:open {title}>
	<ul class="saved" data-testid={testid}>
		{#each items as item (key(item))}
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

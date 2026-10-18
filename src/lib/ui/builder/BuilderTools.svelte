<script lang="ts">
	import type { Snippet } from 'svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';

	/**
	 * The title row's tools on a builder page (Script builder, Character builder): open a
	 * saved one, download it, anything extra (Share), and clear, in that order. One row for
	 * every builder, so they look and behave the same (component review, 2026-10-17).
	 */
	interface Props {
		openLabel: string;
		openDisabled?: boolean;
		onOpen: () => void;
		downloadLabel: string;
		downloadDisabled?: boolean;
		onDownload: () => void;
		clearLabel: string;
		clearDisabled?: boolean;
		onClear: () => void;
		/** Between download and clear, e.g. Share. */
		children?: Snippet;
	}

	let {
		openLabel,
		openDisabled = false,
		onOpen,
		downloadLabel,
		downloadDisabled = false,
		onDownload,
		clearLabel,
		clearDisabled = false,
		onClear,
		children
	}: Props = $props();
</script>

<div class="tools">
	<IconButton icon="open" label={openLabel} disabled={openDisabled} onclick={onOpen} />
	<IconButton
		icon="download"
		label={downloadLabel}
		disabled={downloadDisabled}
		onclick={onDownload}
	/>
	{@render children?.()}
	<DeleteButton class="icon-button" label={clearLabel} disabled={clearDisabled} onclick={onClear} />
</div>

<style>
	.tools {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.tools :global(.icon-button) {
		background: var(--surface-raised);
		box-shadow: inset 0 0 0 1px var(--border);
	}
	@media (hover: hover) {
		.tools :global(.icon-button:hover:not(:disabled)) {
			background: var(--surface-selected);
		}
	}
</style>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import JsonDialog from './JsonDialog.svelte';

	/**
	 * The title row's tools on a builder page (Script builder, Character builder): save, open
	 * a saved one, download it, anything extra (Share), and clear, in that order. One row for
	 * every builder, so they look and behave the same (component review, 2026-10-17).
	 */
	interface Props {
		/**
		 * Save and Save as new, here rather than in the form (Trevor, 2026-10-18: item controls
		 * in the header). Both always shown, so nothing moves; Save reads Saved once nothing has
		 * changed, and only a changed saved one can be copied.
		 */
		save?: {
			/** Something to save exists. */
			ready: boolean;
			/** What's on the builder is what is saved. */
			saved: boolean;
			/** It edits something already saved, so it can be saved as a new one. */
			editing: boolean;
			busy?: boolean;
			onSave: () => void;
			onSaveNew: () => void;
		};
		openLabel: string;
		openDisabled?: boolean;
		onOpen: () => void;
		downloadLabel: string;
		downloadDisabled?: boolean;
		/** Downloads at once; leave out to show `json` first (below). */
		onDownload?: () => void;
		/**
		 * The file, shown read only with Copy and Download before it is downloaded (Trevor,
		 * 2026-10-18: view the script's JSON first). Used when `onDownload` is left out.
		 */
		json?: unknown;
		fileName?: string;
		/** The shown file's title. */
		jsonTitle?: string;
		clearLabel: string;
		clearDisabled?: boolean;
		onClear: () => void;
		/** Between download and clear, e.g. Share. */
		children?: Snippet;
	}

	let {
		save,
		openLabel,
		openDisabled = false,
		onOpen,
		downloadLabel,
		downloadDisabled = false,
		onDownload,
		json,
		fileName = 'file.json',
		jsonTitle = '',
		clearLabel,
		clearDisabled = false,
		onClear,
		children
	}: Props = $props();
	let jsonOpen = $state(false);
</script>

<div class="tools">
	{#if save}
		<IconButton
			icon="save"
			label={save.saved ? t('common.saved') : t('common.save')}
			disabled={!save.ready || save.saved || save.busy}
			onclick={save.onSave}
			data-testid="builder-save"
		/>
		<IconButton
			icon="copy"
			label={t('common.saveNew')}
			disabled={!save.ready || !save.editing || save.saved || save.busy}
			onclick={save.onSaveNew}
			data-testid="builder-save-new"
		/>
	{/if}
	<IconButton icon="open" label={openLabel} disabled={openDisabled} onclick={onOpen} />
	<IconButton
		icon="download"
		label={downloadLabel}
		disabled={downloadDisabled}
		onclick={() => (onDownload ? onDownload() : (jsonOpen = true))}
	/>
	{@render children?.()}
	<DeleteButton class="icon-button" label={clearLabel} disabled={clearDisabled} onclick={onClear} />
</div>

{#if !onDownload && json !== undefined}
	<JsonDialog bind:open={jsonOpen} title={jsonTitle} {json} {fileName} {downloadLabel} />
{/if}

<style>
	.tools {
		display: flex;
		flex-wrap: wrap;
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

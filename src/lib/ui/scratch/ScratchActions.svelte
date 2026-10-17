<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { isBlank } from '#lib/core/scratch/scratch.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import type { ScratchPadState } from './scratch-store.svelte.ts';

	interface Props {
		pad: ScratchPadState;
		/** Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (Cmd on a Mac); on for one place at a time. */
		shortcuts?: boolean;
	}

	let { pad, shortcuts = false }: Props = $props();
	let confirming = $state(false);

	function keydown(event: KeyboardEvent) {
		if (!shortcuts || confirming || !(event.ctrlKey || event.metaKey)) return;
		const key = event.key.toLowerCase();
		if (key === 'z' && !event.shiftKey) pad.undo();
		else if ((key === 'z' && event.shiftKey) || key === 'y') pad.redo();
		else return;
		event.preventDefault();
	}
</script>

<svelte:window onkeydown={keydown} />

<IconButton
	icon="undo"
	label={t('scratch.undo')}
	disabled={pad.history.strokes.length === 0}
	onclick={() => pad.undo()}
/>
<IconButton
	icon="redo"
	label={t('scratch.redo')}
	disabled={pad.history.undone.length === 0}
	onclick={() => pad.redo()}
/>
<span class="danger">
	<IconButton
		icon="remove"
		label={t('scratch.clear')}
		disabled={isBlank(pad.strokes)}
		onclick={() => (confirming = true)}
	/>
</span>

<ConfirmDialog
	bind:open={confirming}
	title={t('scratch.clearConfirm')}
	danger
	onConfirm={() => pad.clear()}
>
	<p>{t('scratch.clearBody')}</p>
</ConfirmDialog>

<style>
	.danger {
		display: contents;
	}
	.danger :global(.icon-button:not(:disabled)) {
		color: var(--evil);
	}
</style>

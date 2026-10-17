<script lang="ts">
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import type { ScratchPadState } from './scratch-store.svelte.ts';

	interface Props {
		pad: ScratchPadState;
		/** Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (Cmd on a Mac); on for one place at a time. */
		shortcuts?: boolean;
		/** Deletes the pad, once confirmed. */
		onDelete: () => void;
	}

	let { pad, shortcuts = false, onDelete }: Props = $props();
	let confirming = $state(false);

	function keydown(event: KeyboardEvent) {
		if (!shortcuts || confirming || pad.locked || !(event.ctrlKey || event.metaKey)) return;
		const key = event.key.toLowerCase();
		if (key === 'z' && !event.shiftKey) pad.undo();
		else if ((key === 'z' && event.shiftKey) || key === 'y') pad.redo();
		else return;
		event.preventDefault();
	}
</script>

<svelte:window onkeydown={keydown} />

<!-- A locked pad can't change by accident, undo included. -->
<IconButton
	icon="undo"
	label={t('scratch.undo')}
	disabled={pad.locked || pad.history.strokes.length === 0}
	onclick={() => pad.undo()}
/>
<IconButton
	icon="redo"
	label={t('scratch.redo')}
	disabled={pad.locked || pad.history.undone.length === 0}
	onclick={() => pad.redo()}
/>
<DeleteButton label={t('scratch.delete')} onclick={() => (confirming = true)} />

<ConfirmDialog
	bind:open={confirming}
	title={t('scratch.deleteConfirm')}
	danger
	onConfirm={onDelete}
>
	<p>{t('scratch.deleteBody', { title: pad.title.trim() || t('scratch.untitled') })}</p>
</ConfirmDialog>

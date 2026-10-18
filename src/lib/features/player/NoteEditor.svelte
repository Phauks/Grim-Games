<script lang="ts">
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import type { PlayerNote } from './notebook.ts';

	interface Props {
		open?: boolean;
		note?: PlayerNote;
		onChange: (patch: { title?: string; text?: string; hidden?: boolean }) => void;
		onDelete: () => void;
	}

	let { open = $bindable(false), note, onChange, onDelete }: Props = $props();
	let confirming = $state(false);
</script>

<!-- A fixed height, so typing never resizes the sheet. -->
<!-- The heading stays "Note" so it doesn't change while the title is typed. -->
<BottomSheet bind:open title={t('player.note')} height="85dvh" focusFirstField={false}>
	<!-- The trash sits beside the sheet's X (Trevor, 2026-10-17); it still confirms first. -->
	{#snippet actions()}
		{#if note}
			<DeleteButton label={t('player.deleteNote')} onclick={() => (confirming = true)} />
		{/if}
	{/snippet}
	{#if note}
		<div class="editor">
			<TextField
				label={t('player.noteTitle')}
				value={note.title}
				oninput={(title) => onChange({ title })}
			/>
			<TextField
				label={t('player.noteText')}
				value={note.text}
				multiline
				grow
				oninput={(text) => onChange({ text })}
			/>
			<div class="actions">
				<!-- Each note hides its own text in the list (Trevor, 2026-10-17). -->
				<Toggle
					label={t('player.hideContents')}
					checked={note.hidden}
					onChange={(hidden) => onChange({ hidden })}
				/>
			</div>
		</div>
	{/if}
</BottomSheet>

<ConfirmDialog
	bind:open={confirming}
	title={t('player.deleteNoteConfirm')}
	danger
	onConfirm={() => {
		open = false;
		onDelete();
	}}
>
	<p>
		{t('player.deleteNoteBody', { title: note?.title.trim() || t('player.untitled') })}
	</p>
</ConfirmDialog>

<style>
	.editor {
		display: grid;
		grid-template-rows: auto 1fr auto;
		gap: var(--space-3);
		height: 100%;
		padding-bottom: var(--space-4);
	}
	/* The note's text takes the sheet's spare height, never less than this. */
	.editor :global(textarea) {
		min-height: 40dvh;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
</style>

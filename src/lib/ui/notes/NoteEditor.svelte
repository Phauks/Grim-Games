<script lang="ts">
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import HideContentsButton from '#lib/ui/primitives/HideContentsButton.svelte';
	import type { TitledNote } from './note.ts';

	interface Props {
		open?: boolean;
		note?: TitledNote;
		/** Shown but not editable: a game opened to view only. */
		readonly?: boolean;
		onChange: (patch: { title?: string; text?: string; hidden?: boolean }) => void;
		onDelete: () => void;
	}

	let { open = $bindable(false), note, readonly = false, onChange, onDelete }: Props = $props();
	let confirming = $state(false);
</script>

<!-- The same full-screen panel as a scratch pad, so notes and pads look alike (Trevor,
     2026-10-18). The heading stays "Note" so it doesn't change while the title is typed. -->
<Dialog bind:open title={t('player.note')} size="max" scroll={false}>
	<!-- The trash sits beside the X (Trevor, 2026-10-17); it still confirms first. -->
	{#snippet headActions()}
		{#if note && !readonly}
			<DeleteButton label={t('player.deleteNote')} onclick={() => (confirming = true)} />
		{/if}
	{/snippet}
	{#if note}
		<div class="editor">
			<!-- The same title row as a scratch pad: the title, then Hide contents. -->
			<div class="title-row">
				<TextField
					label={t('player.noteTitle')}
					value={note.title}
					placeholder={t('player.untitled')}
					disabled={readonly}
					oninput={(title) => onChange({ title })}
				/>
				<!-- Each note hides its own text in the list (Trevor, 2026-10-17). -->
				{#if !readonly}
					<HideContentsButton
						hidden={note.hidden}
						onchange={(hidden) => onChange({ hidden })}
						testid="note-hide"
					/>
				{/if}
			</div>
			<TextField
				label={t('player.noteText')}
				value={note.text}
				multiline
				grow
				disabled={readonly}
				oninput={(text) => onChange({ text })}
			/>
		</div>
	{/if}
</Dialog>

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
		grid-template-rows: auto 1fr;
		gap: var(--space-2);
		flex: 1;
		min-height: 0;
	}
	.title-row {
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);
	}
	.title-row :global(.text-field) {
		flex: 1;
		min-width: 0;
	}
</style>

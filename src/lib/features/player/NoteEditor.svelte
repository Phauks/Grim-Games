<script lang="ts">
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
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
	// Phones don't close the keyboard on Enter in a single-line field; Done should (Trevor).
	function doneOnEnter(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (event.key !== 'Enter' || event.isComposing) return;
		event.preventDefault();
		event.currentTarget.blur();
	}
</script>

<!-- A fixed height, so typing never resizes the sheet. -->
<!-- The heading stays "Note" so it doesn't change while the title is typed. -->
<BottomSheet bind:open title={t('player.note')} height="85dvh" focusFirstField={false}>
	{#if note}
		<div class="editor">
			<label class="field">
				<span>{t('player.noteTitle')}</span>
				<ClearableField value={note.title} onclear={() => onChange({ title: '' })}>
					<input
						type="text"
						value={note.title}
						autocomplete="off"
						enterkeyhint="done"
						oninput={(event) => onChange({ title: event.currentTarget.value })}
						onkeydown={doneOnEnter}
					/>
				</ClearableField>
			</label>
			<label class="field grow">
				<span>{t('player.noteText')}</span>
				<textarea
					value={note.text}
					oninput={(event) => onChange({ text: event.currentTarget.value })}></textarea>
			</label>
			<div class="actions">
				<!-- Each note hides its own text in the list (Trevor, 2026-10-17). -->
				<Toggle
					label={t('player.hideContents')}
					checked={note.hidden}
					onChange={(hidden) => onChange({ hidden })}
				/>
				<!-- A red trash can (Trevor, 2026-10-16); still confirms first. -->
				<DeleteButton label={t('player.deleteNote')} onclick={() => (confirming = true)} />
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
	.field {
		display: grid;
		gap: var(--space-1);
		font-family: var(--font-control);
	}
	.grow {
		grid-template-rows: auto 1fr;
	}
	input,
	textarea {
		min-height: var(--tap-target);
		padding: var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, currentColor 6%, transparent);
		color: inherit;
		font-family: var(--font-body);
		font-size: 1rem;
	}
	textarea {
		min-height: 40dvh;
		resize: none;
	}
	.actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.actions :global(.icon-button) {
		color: var(--evil);
	}
</style>

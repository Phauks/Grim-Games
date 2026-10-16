<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import type { PlayerNote } from './notebook.ts';

	interface Props {
		open?: boolean;
		note?: PlayerNote;
		onChange: (patch: { title?: string; text?: string }) => void;
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
				<input
					type="text"
					value={note.title}
					autocomplete="off"
					enterkeyhint="done"
					oninput={(event) => onChange({ title: event.currentTarget.value })}
					onkeydown={doneOnEnter}
				/>
			</label>
			<label class="field grow">
				<span>{t('player.noteText')}</span>
				<textarea
					value={note.text}
					oninput={(event) => onChange({ text: event.currentTarget.value })}></textarea>
			</label>
			<div class="actions">
				<!-- A red trash can (Trevor, 2026-10-16); still confirms first. -->
				<IconButton
					icon="remove"
					label={t('player.deleteNote')}
					onclick={() => (confirming = true)}
				/>
			</div>
		</div>
	{/if}
</BottomSheet>

<Dialog bind:open={confirming} role="alertdialog" title={t('player.deleteNoteConfirm')}>
	<p>
		{t('player.deleteNoteBody', { title: note?.title.trim() || t('player.untitled') })}
	</p>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (confirming = false)}>{t('player.keep')}</Button>
		<Button
			variant="accent"
			onclick={() => {
				confirming = false;
				open = false;
				onDelete();
			}}>{t('player.delete')}</Button
		>
	{/snippet}
</Dialog>

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
		justify-content: flex-end;
	}
	.actions :global(.icon-button) {
		color: var(--evil);
	}
</style>

<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import NoteRow from './NoteRow.svelte';
	import type { TitledNote } from './note.ts';

	/**
	 * Titled notes, each written where it sits (Trevor, 2026-11-02: "edit them in-line"): the
	 * player's notebook, their notes on each seat, and the Storyteller's game and player notes,
	 * all one list (Trevor, 2026-10-23: parity). With `onSave`, the list ends in a dashed
	 * "+ New note", so an empty list starts as that alone; a new note left blank is not kept.
	 */
	interface Props {
		/** Oldest first. */
		notes: readonly TitledNote[];
		/** Shown but not editable: a game opened to view only. */
		readonly?: boolean;
		/** A changed note; no `noteId` adds it at the end of `notes`. */
		onSave: (note: Omit<TitledNote, 'noteId'> & { noteId?: string }) => void;
		onDelete: (noteId: string) => void;
	}

	let { notes, readonly = false, onSave, onDelete }: Props = $props();

	const NEW: TitledNote = { noteId: '', title: '', text: '', hidden: false };
	/**
	 * "+ New note" was tapped: a blank row waits at the end until it is written in. Nothing is
	 * focused for it, so a phone's keyboard opens only when the note is tapped (Trevor).
	 */
	let adding = $state(false);

	/** The note whose trash was tapped, asked about first. */
	let deleting = $state<TitledNote>();
	let confirming = $state(false);
</script>

{#if notes.length || !readonly}
	<ul class="notes">
		{#each notes as note (note.noteId)}
			<NoteRow
				{note}
				{readonly}
				onSave={(n) => onSave(n)}
				onDelete={(n) => {
					deleting = n;
					confirming = true;
				}}
			/>
		{/each}
		{#if adding && !readonly}
			<NoteRow
				note={NEW}
				onSave={({ title, text, hidden }) => {
					adding = false;
					onSave({ title, text, hidden });
				}}
				onDelete={() => (adding = false)}
				onLeaveBlank={() => (adding = false)}
			/>
		{/if}
		{#if !readonly}
			<li class="add-row">
				<!-- "+ New note" (Trevor, 2026-10-23): a dashed edge and no fill. -->
				<button type="button" class="add" data-testid="new-note" onclick={() => (adding = true)}>
					<Icon name="add" />{t('player.newNote')}
				</button>
			</li>
		{/if}
	</ul>
{:else}
	<p class="none">{t('common.none')}</p>
{/if}

<ConfirmDialog
	bind:open={confirming}
	title={t('player.deleteNoteConfirm')}
	danger
	onConfirm={() => {
		if (deleting) onDelete(deleting.noteId);
		deleting = undefined;
	}}
>
	<p>
		{t('player.deleteNoteBody', { title: deleting?.title.trim() || t('player.untitled') })}
	</p>
</ConfirmDialog>

<style>
	.notes {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.add-row {
		display: grid;
		padding-block-start: var(--space-2);
	}
	.add {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		width: 100%;
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px dashed var(--border);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--on-surface-muted);
		font: inherit;
		font-family: var(--font-control);
		font-weight: 600;
		cursor: pointer;
		touch-action: manipulation;
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>

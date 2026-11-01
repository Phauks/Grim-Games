<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import NoteCards from '#lib/ui/notes/NoteCards.svelte';
	import NoteDraftEditor from '#lib/ui/notes/NoteDraftEditor.svelte';
	import type { TitledNote } from '#lib/ui/notes/note.ts';

	/**
	 * A player's own notes on a seat, in that seat's sheet on their grim: each note its own
	 * card with its title and first line, a hidden one saying so, and a tap opens it (Trevor,
	 * 2026-10-31: two notes "populate together with a , between them ... neither show title,
	 * and don't properly hide text"). The same cards as every other list of notes.
	 */
	interface Props {
		notes: readonly TitledNote[];
		onSave: (note: Omit<TitledNote, 'noteId'> & { noteId?: string }) => void;
		onDelete: (noteId: string) => void;
	}

	let { notes, onSave, onDelete }: Props = $props();
	let editor = $state<ReturnType<typeof NoteDraftEditor>>();
</script>

<div class="row" data-testid="seat-note">
	<span class="label">{t('player.notes')}</span>
	<NoteCards {notes} onOpen={(noteId) => editor?.edit(noteId)} onAdd={() => editor?.edit()} />
</div>

<NoteDraftEditor bind:this={editor} {notes} {onSave} {onDelete} />

<style>
	/* A labelled row with a line under it, as the sheet's other rows. */
	.row {
		display: grid;
		grid-template-columns: calc(6 * var(--u)) 1fr;
		align-items: start;
		gap: var(--space-2);
		margin: 0 0 var(--space-2);
		padding: var(--space-1) 0 var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	.label {
		align-self: center;
		font-family: var(--font-control);
		font-weight: 600;
	}
</style>

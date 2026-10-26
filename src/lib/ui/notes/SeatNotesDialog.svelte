<script lang="ts">
	import type { Snippet } from 'svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import NoteCards from './NoteCards.svelte';
	import NoteDraftEditor from './NoteDraftEditor.svelte';
	import type { TitledNote } from './note.ts';

	/**
	 * One player's notes, as cards ending in a dashed "+ New note", each opening the note editor
	 * (Trevor, 2026-10-26: several notes per player, as the game's notes): the Storyteller's
	 * notes on a seat, from its note mark or ⋯ Notes, and a player's own notes on a seat of their
	 * grim. Each note is kept as its editor closes (NoteDraftEditor).
	 */
	interface Props {
		open: boolean;
		/** "Notes: Ana"; the dialog's accessible name. */
		title: string;
		/** Replaces the title's text, such as "Notes:" and the player's badge. */
		heading?: Snippet;
		/** Under the title, such as the seat's character. */
		subtitle?: Snippet;
		notes: readonly TitledNote[];
		readonly?: boolean;
		onSave: (note: Omit<TitledNote, 'noteId'> & { noteId?: string }) => void;
		onDelete: (noteId: string) => void;
	}

	let {
		open = $bindable(),
		title,
		heading,
		subtitle,
		notes,
		readonly = false,
		onSave,
		onDelete
	}: Props = $props();

	let editor = $state<ReturnType<typeof NoteDraftEditor>>();
</script>

<Dialog bind:open {title} {heading} {subtitle}>
	<div class="notes" data-testid="seat-notes">
		<NoteCards
			{notes}
			onOpen={(noteId) => editor?.edit(noteId)}
			onAdd={readonly ? undefined : () => editor?.edit()}
		/>
	</div>
</Dialog>

<NoteDraftEditor bind:this={editor} {notes} {readonly} {onSave} {onDelete} />

<style>
	/* Room between the subtitle above and the cards (Trevor, 2026-10-19). */
	.notes {
		padding-top: var(--space-3);
	}
</style>

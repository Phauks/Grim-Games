<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import NoteList from '#lib/ui/notes/NoteList.svelte';
	import type { TitledNote } from '#lib/ui/notes/note.ts';

	/**
	 * A player's own notes on a seat, in that seat's sheet on their grim: each note its own row
	 * with its title, a hidden one saying so (Trevor, 2026-10-31: two notes "populate together
	 * with a , between them ... neither show title, and don't properly hide text"), written
	 * where it sits (Trevor, 2026-11-02). The same list as every other list of notes.
	 */
	interface Props {
		notes: readonly TitledNote[];
		onSave: (note: Omit<TitledNote, 'noteId'> & { noteId?: string }) => void;
		onDelete: (noteId: string) => void;
	}

	let { notes, onSave, onDelete }: Props = $props();
</script>

<div class="row" data-testid="seat-note">
	<span class="label">{t('player.notes')}</span>
	<NoteList {notes} {onSave} {onDelete} />
</div>

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

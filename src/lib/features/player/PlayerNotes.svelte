<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import ScratchPadDialog from '#lib/ui/scratch/ScratchPadDialog.svelte';
	import { ScratchPads, type ScratchPadState } from '#lib/ui/scratch/scratch-store.svelte.ts';
	import { NotebookState } from './notebook-store.svelte.ts';
	import NoteEditor from '#lib/ui/notes/NoteEditor.svelte';
	import NotesPanel from './NotesPanel.svelte';

	/**
	 * The Notes tab of the players' script: notes and scratch pads, one notebook per script, kept
	 * on this device only. /play shows it, and so does the Script the Storyteller opens from the
	 * board (Trevor, 2026-10-23: "feature parity"); there the notes are the Storyteller's own.
	 */
	interface Props {
		/** The script's notebook key (`scriptKey`, or `saved:<id>` for a saved script). */
		notesKey: string | undefined;
	}

	let { notesKey }: Props = $props();

	let notebook = $state<NotebookState>();
	$effect(() => {
		const key = notesKey;
		if (!key || notebook?.key === key) return;
		const book = new NotebookState(key);
		noteOpen = false;
		void book.load().then(() => {
			if (book.key === key) notebook = book;
		});
	});

	// Scratch pads per script, like the notebook's notes, in their own database on the device.
	let scratch = $state<ScratchPads>();
	let scratchPad = $state<ScratchPadState>();
	let scratchOpen = $state(false);
	$effect(() => {
		const key = notesKey;
		if (!key || scratch?.base === `player:${key}`) return;
		const pads = new ScratchPads(`player:${key}`);
		scratchOpen = false;
		void pads.load().then(() => {
			if (pads.base === `player:${key}`) scratch = pads;
		});
	});
	function openScratch(pad: ScratchPadState) {
		scratchPad = pad;
		scratchOpen = true;
	}

	// Saving can fail (private browsing, full storage): say so once, as a toast (no reflow).
	let warnedSave = false;
	$effect(() => {
		const scratchError = scratch?.saveError || scratch?.pads.some((pad) => pad.saveError);
		if (!(notebook?.saveError || scratchError) || warnedSave) return;
		warnedSave = true;
		toast(t('player.cannotSave'), t('player.cannotSaveDetail'));
	});

	let noteId = $state<string>();
	let noteOpen = $state(false);
	function openNote(id: string) {
		noteId = id;
		noteOpen = true;
	}
</script>

{#if !notebook}
	<p class="muted">{t('player.loading')}</p>
{:else}
	<NotesPanel
		notes={notebook.book.notes}
		pads={scratch?.pads}
		onAdd={() => openNote(notebook!.addNote())}
		onOpenNote={openNote}
		onAddScratch={() => scratch && openScratch(scratch.add())}
		onOpenScratch={openScratch}
	/>
{/if}

{#if notebook}
	<ErrorBoundary area="play">
		<NoteEditor
			bind:open={noteOpen}
			note={notebook.book.notes.find((n) => n.noteId === noteId)}
			onChange={(patch) => noteId && notebook!.updateNote(noteId, patch)}
			onDelete={() => noteId && notebook!.deleteNote(noteId)}
		/>
	</ErrorBoundary>
{/if}
{#if scratch && scratchPad}
	<ErrorBoundary area="play">
		<ScratchPadDialog
			bind:open={scratchOpen}
			pad={scratchPad}
			onDelete={() => scratchPad && void scratch!.remove(scratchPad)}
		/>
	</ErrorBoundary>
{/if}

<style>
	.muted {
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
</style>

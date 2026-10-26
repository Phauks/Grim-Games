<script lang="ts">
	import { untrack } from 'svelte';
	import NoteEditor from './NoteEditor.svelte';
	import type { TitledNote } from './note.ts';

	/**
	 * The note editor for a list kept elsewhere: the Storyteller's game notes and notes on each
	 * player, and a player's own notes on each seat of their grim (Trevor, 2026-10-26: "the new
	 * note function we use for game notes should be used for characters as well"). The note is
	 * written as a draft and told to `onSave` as the editor closes, however it closes, and if the
	 * app is put away mid-edit; a new note left blank is not kept.
	 */
	interface Props {
		/** The list the note belongs to, oldest first. */
		notes: readonly TitledNote[];
		readonly?: boolean;
		/** A changed note; no `noteId` adds it at the end of `notes`. */
		onSave: (note: Omit<TitledNote, 'noteId'> & { noteId?: string }) => void;
		onDelete: (noteId: string) => void;
	}

	let { notes, readonly = false, onSave, onDelete }: Props = $props();

	let open = $state(false);
	/** The note as it is being written; a new one has no id until it is kept. */
	let draft = $state<TitledNote>();

	/** Opens the note with this id, or a new one. */
	export function edit(noteId?: string) {
		const note = notes.find((n) => n.noteId === noteId);
		draft = note ? { ...note } : { noteId: '', title: '', text: '', hidden: false };
		open = true;
	}

	function save() {
		const note = draft;
		if (!note || readonly) return;
		const { title, text, hidden } = note;
		if (note.noteId) {
			const before = notes.find((n) => n.noteId === note.noteId);
			if (!before) return;
			if (before.title === title.trim() && before.text === text.trim() && before.hidden === hidden)
				return;
			onSave({ noteId: note.noteId, title, text, hidden });
		} else if (title.trim() || text.trim()) {
			onSave({ title, text, hidden });
		}
	}
	$effect(() => {
		if (open) return;
		untrack(() => {
			save();
			draft = undefined;
		});
	});
</script>

<svelte:document
	onvisibilitychange={() => {
		if (document.visibilityState !== 'hidden' || !open) return;
		const isNew = draft && !draft.noteId;
		save();
		// A new note is kept now, so it is edited, not added again, when the app returns.
		const added = isNew ? notes.at(-1) : undefined;
		if (added && draft) draft = { ...draft, noteId: added.noteId };
	}}
/>

<NoteEditor
	bind:open
	note={draft}
	{readonly}
	onChange={(patch) => draft && (draft = { ...draft, ...patch })}
	onDelete={() => {
		const id = draft?.noteId;
		draft = undefined;
		if (id && !readonly) onDelete(id);
	}}
/>

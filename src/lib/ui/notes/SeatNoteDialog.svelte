<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';

	/**
	 * One player's note, a few lines in one growing field (Trevor, 2026-10-19): the
	 * Storyteller's note on a seat (NotesSheet) and a player's own note on a seat in their grim
	 * (Trevor, 2026-10-24). Saved as it closes, however it closes, with no Save or Cancel (Trevor,
	 * 2026-10-17: a swipe down keeps it), and if the app is put away mid-edit.
	 */
	interface Props {
		open: boolean;
		/** "Note: Ana"; also the field's accessible name. */
		title: string;
		/** Under the title, such as the seat's character. */
		subtitle?: Snippet;
		/** The note when the dialog opens. */
		value: string;
		readonly?: boolean;
		/** Told the text once it changed, as the dialog closes or the app is put away. */
		onSave: (text: string) => void;
	}

	let { open = $bindable(), title, subtitle, value, readonly = false, onSave }: Props = $props();

	let draft = $state('');
	let saved = '';
	$effect(() => {
		if (!open) return;
		untrack(() => {
			draft = value;
			saved = value;
		});
	});
	function save() {
		if (readonly || draft.trim() === saved.trim()) return;
		saved = draft;
		onSave(draft);
	}
	let wasOpen = false;
	$effect(() => {
		const now = open;
		untrack(() => {
			if (wasOpen && !now) save();
			wasOpen = now;
		});
	});
</script>

<svelte:document
	onvisibilitychange={() => {
		if (open && document.visibilityState === 'hidden') save();
	}}
/>

<Dialog bind:open {title} {subtitle}>
	<!-- Several lines: Enter starts a new line, and the field grows with them. -->
	<div class="editor">
		<TextField
			label={title}
			hideLabel
			multiline
			rows={5}
			bind:value={draft}
			disabled={readonly}
			testid="note-editor"
			autogrow
		/>
	</div>
</Dialog>

<style>
	/* Room between the subtitle above and the field (Trevor, 2026-10-19). */
	.editor {
		padding-top: var(--space-3);
	}
</style>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import HideContentsButton from '#lib/ui/primitives/HideContentsButton.svelte';
	import RichTextField from '#lib/ui/primitives/RichTextField.svelte';
	import type { TitledNote } from './note.ts';

	/**
	 * One titled note, written where it sits in its list (Trevor, 2026-11-02: "edit them
	 * in-line"): the title on the first line with Hide contents and the trash at its end, the
	 * whole text under it. While the text is written, the formatting tools take the place of the
	 * eye and trash, so the row keeps its height. The note is told to `onSave` as focus leaves
	 * the row, or the app is put away, and only when it changed.
	 */
	interface Props {
		/** The note as kept; a new one has an empty `noteId`. */
		note: TitledNote;
		/** Shown but not editable: a game opened to view only. */
		readonly?: boolean;
		onSave: (note: TitledNote) => void;
		onDelete: (note: TitledNote) => void;
		/** Focus has left a new note with nothing written in it. */
		onLeaveBlank?: () => void;
		/**
		 * Has the eye that hides its text; off for the Storyteller's own notes (Trevor,
		 * 2026-11-17: no world where a Storyteller hides notes), which then always show it.
		 */
		hideable?: boolean;
		/** Whose the note is, on the title's line (the Storyteller's notes: the game or a player). */
		owner?: Snippet;
		/** A ⋯ menu in place of the trash, which holds Delete with the note's other choices. */
		menu?: Snippet;
	}

	let {
		note,
		readonly = false,
		onSave,
		onDelete,
		onLeaveBlank,
		hideable = true,
		owner,
		menu
	}: Props = $props();

	let row = $state<HTMLElement>();
	let titleInput = $state<HTMLInputElement>();
	/** Focus is in this row: the draft is the user's, never replaced from outside. */
	let editing = $state(false);
	/** The text is being written: its tools stand where the eye and trash are. */
	let typing = $state(false);
	// svelte-ignore state_referenced_locally
	let draft = $state({ ...note });
	$effect.pre(() => {
		const kept = note;
		if (!editing) draft = { ...kept };
	});
	/** A view-only note's text, shown for a moment without changing the note. */
	let peek = $state(false);
	const hidden = $derived(hideable && (readonly ? draft.hidden && !peek : draft.hidden));

	const blank = (n: TitledNote) => !n.title.trim() && !n.text.trim();
	// A list closed mid-note (its sheet swiped away) keeps the note, as leaving it does.
	$effect(() => () => {
		if (editing) save();
	});

	function save() {
		if (readonly) return;
		const { title, text, hidden } = draft;
		if (!note.noteId) {
			if (!blank(draft)) onSave({ ...draft });
			return;
		}
		if (note.title === title && note.text === text && note.hidden === hidden) return;
		onSave({ ...draft });
	}
</script>

<svelte:document
	onvisibilitychange={() => {
		if (document.visibilityState === 'hidden' && editing) save();
	}}
/>

<li
	bind:this={row}
	class="note"
	data-note={note.noteId || undefined}
	data-new-note={note.noteId ? undefined : ''}
	data-typing={typing || undefined}
	onfocusin={() => (editing = true)}
	onfocusout={(e) => {
		const next = e.relatedTarget;
		if (next instanceof Node && row?.contains(next)) return;
		editing = false;
		if (!note.noteId && blank(draft)) onLeaveBlank?.();
		else save();
	}}
>
	<div class="line">
		<!-- Every one-line field has its X (Trevor, 2026-10-16), here only while it is written in. -->
		<ClearableField class="title-field" bind:value={draft.title} disabled={readonly}>
			<input
				bind:this={titleInput}
				class="title"
				bind:value={draft.title}
				placeholder={t('player.untitled')}
				aria-label={t('player.noteTitle')}
				disabled={readonly}
				enterkeyhint="done"
				autocomplete="off"
				data-testid="note-title"
				onkeydown={(e) => {
					// Enter commits (Trevor's rule): the title is kept as focus leaves the row.
					if (e.key === 'Enter') {
						e.preventDefault();
						titleInput?.blur();
					}
				}}
			/>
		</ClearableField>
		<span class="actions">
			<!-- Each note hides its own text (Trevor, 2026-10-17). -->
			{#if hideable}<HideContentsButton
					{hidden}
					onchange={(value) => {
						if (readonly) peek = !value;
						else {
							// Kept at once: tapping the eye is the whole change.
							draft.hidden = value;
							save();
						}
					}}
					testid="note-hide"
				/>{/if}
			{#if owner}<span class="owner">{@render owner()}</span>{/if}
			{#if menu}{#if !readonly}{@render menu()}{/if}{:else if !readonly}
				<DeleteButton label={t('player.deleteNote')} onclick={() => onDelete(note)} />
			{/if}
		</span>
	</div>
	<!-- A hidden note keeps its title; one line says Hidden, so nothing else moves. -->
	{#if hidden}
		<p class="hidden">{t('player.hidden')}</p>
	{:else}
		<!-- The same rich box as info cards: formatting and typed lists (Trevor, 2026-10-31). -->
		<RichTextField
			label={t('player.noteText')}
			bind:value={draft.text}
			bind:active={typing}
			inline
			multiline
			lists
			disabled={readonly}
		/>
	{/if}
</li>

<style>
	/* A row with a line under it, not a card; the tools of the text sit over its first line. */
	.note {
		position: relative;
		display: grid;
		gap: var(--space-1);
		padding-block-end: var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	.line {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
	}
	/* The title is written in the same well as the text under it, so the two read as one note
	   (Trevor, 2026-11-19: they "look and feel different"); a view-only note has neither. */
	.line :global(.title-field) {
		border-radius: var(--radius-md);
		background: var(--surface-selected);
	}
	.line :global(.title-field:focus-within) {
		box-shadow: inset 0 0 0 2px var(--focus); /* px-ok: the focus ring's width, as the text's */
	}
	.note:has(.title:disabled) :global(.title-field) {
		background: none;
	}
	.line :global(.title-field:not(:focus-within) .clear) {
		visibility: hidden;
	}
	.title {
		flex: 1;
		min-width: 0;
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 0;
		background: none;
		color: var(--on-surface);
		font-family: var(--font-control);
		font-weight: 600;
		/* iOS zooms into fields under 16px. */
		font-size: max(1rem, 16px); /* px-ok: iOS zooms into fields under 16px */
		text-overflow: ellipsis;
	}
	.title:focus {
		outline: none;
	}
	.title:disabled {
		opacity: 1;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.owner {
		display: flex;
		align-items: center;
		max-width: 50%;
		min-width: 0;
	}
	[data-typing] .actions {
		visibility: hidden;
	}
	.hidden {
		margin: 0;
		color: var(--on-surface-muted);
		font-style: italic;
	}
</style>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import NoneState from '#lib/ui/primitives/NoneState.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import AddRow from '#lib/ui/primitives/AddRow.svelte';
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
		/** Each note has the eye that hides its text (NoteRow); off for the Storyteller's. */
		hideable?: boolean;
		/**
		 * Whose each note is, on its title's line (the Storyteller's: the game or a player); a new
		 * one comes with an empty `noteId`.
		 */
		owner?: Snippet<[TitledNote]>;
		/**
		 * A ⋯ menu in place of each note's trash; its second argument asks to delete the note,
		 * with the same question the trash asks.
		 */
		menu?: Snippet<[TitledNote, () => void]>;
	}

	let { notes, readonly = false, onSave, onDelete, hideable = true, owner, menu }: Props = $props();

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
			{@const askDelete = () => {
				deleting = note;
				confirming = true;
			}}
			{#snippet noteOwner()}{@render owner?.(note)}{/snippet}
			{#snippet noteMenu()}{@render menu?.(note, askDelete)}{/snippet}
			<NoteRow
				{hideable}
				{note}
				{readonly}
				owner={owner ? noteOwner : undefined}
				menu={menu ? noteMenu : undefined}
				onSave={(n) => onSave(n)}
				onDelete={askDelete}
			/>
		{/each}
		{#if adding && !readonly}
			{#snippet newOwner()}{@render owner?.(NEW)}{/snippet}
			<!-- A new note says whose it will be; its ⋯ comes once it is kept. -->
			<NoteRow
				{hideable}
				note={NEW}
				owner={owner ? newOwner : undefined}
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
				<AddRow
					label={t('player.newNote')}
					data-testid="new-note"
					onclick={() => (adding = true)}
				/>
			</li>
		{/if}
	</ul>
{:else}
	<NoneState />
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
</style>

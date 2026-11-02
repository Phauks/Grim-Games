<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import ScratchPadDialog from '#lib/ui/scratch/ScratchPadDialog.svelte';
	import { ScratchPads, type ScratchPadState } from '#lib/ui/scratch/scratch-store.svelte.ts';
	import { NotebookState } from './notebook-store.svelte.ts';
	import NotesPanel from './NotesPanel.svelte';
	import type { PublicSeat } from '#lib/core/sync/public-projection.ts';
	import { gameKey, lastRoom } from '#lib/features/room/player.svelte.ts';
	import { releaseRoom, useRoom } from '#lib/features/room/room-connection.ts';
	import { deleteSeatNote, saveSeatNote, seatNotes } from './seat-notes.svelte.ts';
	import { characterGuesses, readGuesses } from './grim-guesses.ts';

	/**
	 * The Notes tab of the players' script: notes and scratch pads, one notebook per script, kept
	 * on this device only. /play shows it, and so does the Script the Storyteller opens from the
	 * board (Trevor, 2026-10-23: "feature parity"); there the notes are the Storyteller's own.
	 */
	interface Props {
		/** The script's notebook key (`scriptKey`, or `saved:<id>` for a saved script). */
		notesKey: string | undefined;
		/**
		 * The town as the table knows it, given by the Storyteller's board, with the key its
		 * Grim tab keeps notes under; a phone reads its room instead (as PlayerGrim does).
		 */
		town?: { seats: readonly PublicSeat[]; guessKey: string };
	}

	let { notesKey, town }: Props = $props();

	// The player's notes on each seat, written from the Grim tab or here (Trevor, 2026-10-24).
	// svelte-ignore state_referenced_locally
	const room = town ? town.guessKey : lastRoom();
	// svelte-ignore state_referenced_locally
	const player = !town && room ? useRoom(room) : undefined;
	$effect(() => () => {
		if (player) releaseRoom(player);
	});
	const seats = $derived(town?.seats ?? player?.view?.public?.seats ?? []);
	/** Where this game's seat notes and guesses are kept: per game (`gameKey`), as the Grim tab. */
	const kept = $derived(town ? town.guessKey : room ? gameKey(room) : undefined);
	// Set in an effect, not a derived, so the derived below follows the notes it reads.
	// eslint-disable-next-line svelte/prefer-writable-derived -- a store made inside a derived is not followed
	let book = $state<ReturnType<typeof seatNotes>>();
	$effect.pre(() => {
		book = kept ? seatNotes(kept) : undefined;
	});
	const notesOnSeats = $derived(book?.notes ?? {});
	const nameOf = (seat: PublicSeat) =>
		seat.playerName ?? t('common.seat', { number: seat.seatNumber });
	const guesses = $derived(kept ? readGuesses(kept) : {});

	let notebook = $state<NotebookState>();
	$effect(() => {
		const key = notesKey;
		if (!key || notebook?.key === key) return;
		const book = new NotebookState(key);
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

	/** A note written in its row (NoteList); a new one is kept only once it has words in it. */
	function saveNote(note: { noteId?: string; title: string; text: string; hidden: boolean }) {
		if (!notebook) return;
		const { title, text, hidden } = note;
		notebook.updateNote(note.noteId || notebook.addNote(), { title, text, hidden });
	}
</script>

{#if !notebook}
	<p class="muted">{t('player.loading')}</p>
{:else}
	<NotesPanel
		notes={notebook.book.notes}
		pads={scratch?.pads}
		onSaveNote={saveNote}
		onDeleteNote={(noteId) => notebook!.deleteNote(noteId)}
		onAddScratch={() => scratch && openScratch(scratch.add())}
		onOpenScratch={openScratch}
		seats={room && seats.length
			? seats.map((s) => ({
					seatId: s.seatId,
					name: nameOf(s),
					notes: notesOnSeats[s.seatId] ?? [],
					// The Traveller the town knows, or every character this player guesses, all
					// alike after the player's name (Trevor, 2026-10-27).
					characterIds: s.traveller ? [s.traveller] : characterGuesses(guesses, s.seatId)
				}))
			: undefined}
		onSaveSeatNote={(seatId, note) => kept && saveSeatNote(kept, seatId, note)}
		onDeleteSeatNote={(seatId, noteId) => kept && deleteSeatNote(kept, seatId, noteId)}
	/>
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

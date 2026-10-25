<script lang="ts">
	import { untrack } from 'svelte';
	import type { SeatId } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { seatLabel, seatName } from '#lib/features/game/seat-label.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import NoteCards from '#lib/ui/notes/NoteCards.svelte';
	import NoteEditor from '#lib/ui/notes/NoteEditor.svelte';
	import type { TitledNote } from '#lib/ui/notes/note.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import SeatNoteDialog from '#lib/ui/notes/SeatNoteDialog.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import SeatNoteEntry from './SeatNoteEntry.svelte';

	/**
	 * Every note in the game on one screen (Trevor, 2026-10-19): the game's titled notes as
	 * the player's notebook shows them, ending in a dashed "+ New note" (Trevor, 2026-10-23),
	 * then each player's note, headed by their character, seat and name. Player notes live
	 * here, not in the seat sheet; a seat's pen mark or its ⋯ Notes opens just that note's
	 * editor (`edit`). Never shown to players.
	 */
	interface Props {
		open: boolean;
		grimoire: Grimoire;
	}

	let { open = $bindable(), grimoire }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const viewOnly = $derived(grimoire.open.viewOnly);

	// ── Editing one seat's note (SeatNoteDialog: saved as it closes, one History entry) ──
	let editOpen = $state(false);
	let editing = $state<SeatId>();

	/** Opens a seat's note editor; also used straight from its ⋯ menu, without the sheet. */
	export function edit(seatId: SeatId) {
		editing = seatId;
		editOpen = true;
	}
	function saveSeatNote(seatId: SeatId | undefined, note: string) {
		if (seatId && !viewOnly) grimoire.run({ type: 'SetSeatNote', seatId, note });
	}
	// The dialog's and field's accessible name; the heading shows the player's badge.
	const editTitle = $derived(
		// eslint-disable-next-line grim/names-as-badges -- an accessible name, see above
		editing === undefined ? '' : `Note: ${seatName(game, editing)}`
	);

	// ── Game notes, in the player's notebook editor (Trevor, 2026-10-23) ──
	let gameNoteOpen = $state(false);
	/** The note as it is being written; a new one has no id until it is kept. */
	let gameDraft = $state<TitledNote>();

	function openGameNote(noteId?: string) {
		const note = game.notes?.find((n) => n.noteId === noteId);
		gameDraft = note ? { ...note } : { noteId: '', title: '', text: '', hidden: false };
		gameNoteOpen = true;
	}

	function saveGameNote() {
		const note = gameDraft;
		if (!note || viewOnly) return;
		const { title, text, hidden } = note;
		if (note.noteId) {
			const before = game.notes?.find((n) => n.noteId === note.noteId);
			if (!before) return;
			if (before.title === title.trim() && before.text === text.trim() && before.hidden === hidden)
				return;
			grimoire.run({ type: 'SetGameNote', noteId: note.noteId, title, text, hidden });
		} else if (title.trim() || text.trim()) {
			grimoire.run({ type: 'SetGameNote', title, text, hidden });
		}
	}
	$effect(() => {
		if (gameNoteOpen) return;
		untrack(() => {
			saveGameNote();
			gameDraft = undefined;
		});
	});

	function deleteGameNote() {
		const id = gameDraft?.noteId;
		gameDraft = undefined;
		if (id && !viewOnly) grimoire.run({ type: 'DeleteGameNote', noteId: id });
	}
</script>

<svelte:document
	onvisibilitychange={() => {
		if (document.visibilityState !== 'hidden') return;
		if (gameNoteOpen) {
			saveGameNote();
			// A new note is kept now, so it is edited, not added again, when the app returns.
			const added = gameDraft && !gameDraft.noteId ? game.notes?.at(-1) : undefined;
			if (added && gameDraft) gameDraft = { ...gameDraft, noteId: added.noteId };
		}
	}}
/>

<BottomSheet bind:open title="Notes">
	<div class="notes" data-testid="notes-sheet">
		<section aria-labelledby="notes-game">
			<h3 id="notes-game">Game</h3>
			<NoteCards
				notes={game.notes ?? []}
				onOpen={openGameNote}
				onAdd={viewOnly ? undefined : () => openGameNote()}
			/>
		</section>
		<section aria-labelledby="notes-players">
			<h3 id="notes-players">Players</h3>
			<ul>
				{#each game.seating as seatId (seatId)}
					{@const seat = game.seats[seatId]}
					{@const label = seatLabel(game, seatId)}
					<li data-seat={seatId}>
						<!-- Character, seat and name above the note (Trevor, 2026-10-19). -->
						<SeatNoteEntry
							characterId={seat.characterId}
							alignment={seat.alignment}
							{label}
							playerName={seatName(game, seatId)}
							note={seat.note}
							onOpen={() => edit(seatId)}
						/>
					</li>
				{/each}
			</ul>
		</section>
	</div>
</BottomSheet>

{#snippet seatCharacter()}
	<!-- "Note: Ana", then her character on its own line (Trevor, 2026-10-19). -->
	{@const seat = editing ? game.seats[editing] : undefined}
	{#if seat?.characterId}
		<CharacterBadge
			characterId={seat.characterId}
			character={characters.get(seat.characterId)}
			alignment={seat.alignment}
		/>
	{:else}
		None
	{/if}
{/snippet}

{#snippet noteHeading()}Note: {#if editing !== undefined}<PlayerBadge
			name={seatName(game, editing)}
		/>{/if}{/snippet}

<!-- Never shown to players. -->
<SeatNoteDialog
	bind:open={editOpen}
	title={editTitle}
	subtitle={editing === undefined ? undefined : seatCharacter}
	heading={editing === undefined ? undefined : noteHeading}
	value={editing ? (game.seats[editing]?.note ?? '') : ''}
	readonly={viewOnly}
	onSave={(note) => saveSeatNote(editing, note)}
/>

<NoteEditor
	bind:open={gameNoteOpen}
	note={gameDraft}
	readonly={viewOnly}
	onChange={(patch) => gameDraft && (gameDraft = { ...gameDraft, ...patch })}
	onDelete={deleteGameNote}
/>

<style>
	.notes {
		display: grid;
		gap: var(--space-4);
	}
	h3 {
		margin: 0 0 var(--space-1);
		font-size: 1rem;
	}
	ul {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>

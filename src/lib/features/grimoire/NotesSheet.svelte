<script lang="ts">
	import type { SeatId } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { seatLabel, seatName } from '#lib/features/game/seat-label.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import NoteCards from '#lib/ui/notes/NoteCards.svelte';
	import NoteDraftEditor from '#lib/ui/notes/NoteDraftEditor.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import SeatNotesDialog from '#lib/ui/notes/SeatNotesDialog.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import SeatNoteEntry from './SeatNoteEntry.svelte';

	/**
	 * Every note in the game on one screen (Trevor, 2026-10-19): the game's titled notes as
	 * the player's notebook shows them, ending in a dashed "+ New note" (Trevor, 2026-10-23),
	 * then each player's notes, headed by their character, seat and name, as the same cards
	 * (Trevor, 2026-10-26: several notes per player). Player notes live here, not in the seat
	 * sheet; a seat's pen mark or its ⋯ Notes opens just that player's notes (`edit`). Never
	 * shown to players.
	 */
	interface Props {
		open: boolean;
		grimoire: Grimoire;
	}

	let { open = $bindable(), grimoire }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const viewOnly = $derived(grimoire.open.viewOnly);

	// ── One player's notes (SeatNotesDialog), from their pen mark or ⋯ Notes ──
	let seatOpen = $state(false);
	let editing = $state<SeatId>();

	/** Opens a seat's notes; also used straight from its ⋯ menu, without the sheet. */
	export function edit(seatId: SeatId) {
		editing = seatId;
		seatOpen = true;
	}
	// The dialog's accessible name; the heading shows the player's badge.
	const editTitle = $derived(
		// eslint-disable-next-line grim/names-as-badges -- an accessible name, see above
		editing === undefined ? '' : `Notes: ${seatName(game, editing)}`
	);

	// ── A note opened from this sheet: the game's (no seat) or a player's ──
	let editor = $state<ReturnType<typeof NoteDraftEditor>>();
	/** Whose note the sheet's editor has open; undefined for a game note. */
	let noteSeat = $state<SeatId>();
	function openNote(seatId: SeatId | undefined, noteId?: string) {
		noteSeat = seatId;
		editor?.edit(noteId);
	}
	const seatNotes = (seatId: SeatId | undefined) => (seatId && game.seats[seatId]?.notes) || [];

	type Written = { noteId?: string; title: string; text: string; hidden: boolean };
	function saveNote(seatId: SeatId | undefined, note: Written) {
		if (viewOnly) return;
		if (seatId) grimoire.run({ type: 'SetSeatNote', seatId, ...note });
		else grimoire.run({ type: 'SetGameNote', ...note });
	}
	function deleteNote(seatId: SeatId | undefined, noteId: string) {
		if (viewOnly) return;
		if (seatId) grimoire.run({ type: 'DeleteSeatNote', seatId, noteId });
		else grimoire.run({ type: 'DeleteGameNote', noteId });
	}
</script>

<BottomSheet bind:open title="Notes">
	<div class="notes" data-testid="notes-sheet">
		<section aria-labelledby="notes-game">
			<h3 id="notes-game">Game</h3>
			<NoteCards
				notes={game.notes ?? []}
				onOpen={(noteId) => openNote(undefined, noteId)}
				onAdd={viewOnly ? undefined : () => openNote(undefined)}
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
							notes={seat.notes ?? []}
							onOpen={(noteId) => openNote(seatId, noteId)}
							onAdd={viewOnly ? undefined : () => openNote(seatId)}
						/>
					</li>
				{/each}
			</ul>
		</section>
	</div>
</BottomSheet>

{#snippet seatCharacter()}
	<!-- "Notes: Ana", then their character on its own line (Trevor, 2026-10-19). -->
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

{#snippet noteHeading()}Notes: {#if editing !== undefined}<PlayerBadge
			name={seatName(game, editing)}
		/>{/if}{/snippet}

<!-- Never shown to players. -->
<SeatNotesDialog
	bind:open={seatOpen}
	title={editTitle}
	subtitle={editing === undefined ? undefined : seatCharacter}
	heading={editing === undefined ? undefined : noteHeading}
	notes={seatNotes(editing)}
	readonly={viewOnly}
	onSave={(note) => saveNote(editing, note)}
	onDelete={(noteId) => deleteNote(editing, noteId)}
/>

<NoteDraftEditor
	bind:this={editor}
	notes={noteSeat ? seatNotes(noteSeat) : (game.notes ?? [])}
	readonly={viewOnly}
	onSave={(note) => saveNote(noteSeat, note)}
	onDelete={(noteId) => deleteNote(noteSeat, noteId)}
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

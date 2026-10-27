<script lang="ts">
	import type { Alignment, CharacterId, PlayerName } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterEntry from '#lib/features/characters/CharacterEntry.svelte';
	import NoteCards from '#lib/ui/notes/NoteCards.svelte';
	import type { TitledNote } from '#lib/ui/notes/note.ts';

	/**
	 * One player's notes in a list of them, headed by their character, seat and name (Trevor,
	 * 2026-10-19): the Storyteller's Notes sheet, and a player's Notes tab with the character
	 * they guess (Trevor, 2026-10-24). The notes are cards, as the game's notes, ending in a
	 * dashed "+ New note" (Trevor, 2026-10-26: several notes per player).
	 */
	interface Props {
		/** The seat's character, or the player's guess of it; the label alone without one. */
		characterId?: CharacterId;
		/**
		 * A player's guesses of the seat, all alike after their name badge, which leads as the
		 * one thing about a seat that never changes (Trevor, 2026-10-27). Not with `characterId`.
		 */
		guesses?: readonly CharacterId[];
		alignment?: Alignment;
		/** "Seat 3: Ana", or the seat alone while unnamed. */
		label: string;
		/** The player's badge text ("Ana", or "Seat 3"); the label when not given. */
		playerName?: PlayerName;
		notes: readonly TitledNote[];
		onOpen: (noteId: string) => void;
		/** Absent when notes can't be added (a game opened to view only). */
		onAdd?: () => void;
	}

	let {
		characterId,
		guesses = [],
		alignment,
		label,
		playerName = label,
		notes,
		onOpen,
		onAdd
	}: Props = $props();
</script>

<CharacterEntry {characterId} {alignment} {playerName} {label}>
	{#snippet end()}{#if guesses.length}<span class="guesses" data-testid="note-guesses"
				>{#each guesses as id (id)}<CharacterBadge characterId={id} />{/each}</span
			>{/if}{/snippet}
	<div role="group" aria-label={`Notes for ${label}`}>
		<NoteCards {notes} {onOpen} {onAdd} />
	</div>
</CharacterEntry>

<style>
	/* The guesses after the name, wrapping under it when the line is too narrow. */
	.guesses {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>

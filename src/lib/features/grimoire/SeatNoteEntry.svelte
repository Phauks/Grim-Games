<script lang="ts">
	import type { Alignment, CharacterId, PlayerName } from '#lib/core/data/index.ts';
	import CharacterEntry from '#lib/features/characters/CharacterEntry.svelte';

	/**
	 * One player's note in a list of them, headed by their character, seat and name (Trevor,
	 * 2026-10-19): the Storyteller's Notes sheet, and a player's Notes tab with the character
	 * they guess (Trevor, 2026-10-24). Tapping the note opens its editor (SeatNoteDialog).
	 */
	interface Props {
		/** The seat's character, or the player's guess of it; the label alone without one. */
		characterId?: CharacterId;
		alignment?: Alignment;
		/** "Seat 3: Ana", or the seat alone while unnamed. */
		label: string;
		/** The player's badge text ("Ana", or "Seat 3"); the label when not given. */
		playerName?: PlayerName;
		note: string | undefined;
		onOpen: () => void;
	}

	let { characterId, alignment, label, playerName = label, note, onOpen }: Props = $props();
</script>

<CharacterEntry {characterId} {alignment} {playerName} {label}>
	<button
		type="button"
		class="note"
		aria-label={note ? `Notes for ${label}: ${note}` : `Notes for ${label}: None`}
		onclick={onOpen}>{note ?? 'None'}</button
	>
</CharacterEntry>

<style>
	/* The note as it reads in its editor: the list's own text, every line kept. */
	.note {
		display: block;
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: start;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		cursor: pointer;
	}
</style>

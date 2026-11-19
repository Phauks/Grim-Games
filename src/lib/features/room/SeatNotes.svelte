<script lang="ts">
	import type { SeatId } from '#lib/core/model/index.ts';
	import type { Command } from '#lib/core/engine/index.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import NoteList from '#lib/ui/notes/NoteList.svelte';

	/**
	 * The Storyteller's notes on one seat, written in place (Trevor, 2026-11-02), never hidden
	 * from themselves. In a player's row on Players, or a Notes list of every player.
	 */
	interface Props {
		game: OpenGame;
		seatId: SeatId;
		/** How a note is saved: the board's, with its toasts, or the game's own. */
		run?: (command: Command) => boolean;
	}

	let { game, seatId, run = (command) => game.run(command).ok }: Props = $props();

	const viewOnly = $derived(game.viewOnly);
	const notes = $derived(game.game.seats[seatId]?.notes ?? []);
</script>

<NoteList
	{notes}
	readonly={viewOnly}
	onSave={(note) => {
		if (!viewOnly) run({ type: 'SetSeatNote', seatId, ...note });
	}}
	onDelete={(noteId) => {
		if (!viewOnly) run({ type: 'DeleteSeatNote', seatId, noteId });
	}}
	hideable={false}
/>

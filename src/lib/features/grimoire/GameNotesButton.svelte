<script lang="ts">
	import type { Command } from '#lib/core/engine/index.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import NoteCards from '#lib/ui/notes/NoteCards.svelte';
	import NoteDraftEditor from '#lib/ui/notes/NoteDraftEditor.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { gameNotesDialog } from './game-notes-dialog.svelte.ts';

	/**
	 * The game's own notes, beside the grim cover and styled like it (Trevor, 2026-11-01: "place
	 * the notes button next to the grim cover button"), in every game, on the board and the day
	 * alike. They open over the screen, out of Players, which now holds only the players.
	 */
	interface Props {
		game: OpenGame;
		/** How a note is saved: the board's, with its toasts, or the game's own. */
		run?: (command: Command) => boolean;
		outlined?: boolean;
		/**
		 * The board's: opened from More too, and on a phone narrower than the toolbar's eight
		 * buttons need (a 390-wide iPhone), only from More, so ⋯ stays on the screen.
		 */
		board?: boolean;
	}

	let {
		game,
		run = (command) => game.run(command).ok,
		outlined = false,
		board = false
	}: Props = $props();

	let local = $state(false);
	const open = {
		get value() {
			return board ? gameNotesDialog.open : local;
		},
		set value(v: boolean) {
			if (board) gameNotesDialog.open = v;
			else local = v;
		}
	};
	let editor = $state<ReturnType<typeof NoteDraftEditor>>();
	const notes = $derived(game.game.notes ?? []);
	const viewOnly = $derived(game.viewOnly);
</script>

<span class="notes-slot" class:on-board={board}
	><IconButton
		icon="notes"
		label={t('room.players.gameNotes')}
		data-testid="game-notes-button"
		{outlined}
		onclick={() => (open.value = true)}
	/></span
>
<Dialog bind:open={() => open.value, (v) => (open.value = v)} title={t('room.players.gameNotes')}>
	<div data-testid="game-notes">
		<NoteCards
			{notes}
			onOpen={(noteId) => editor?.edit(noteId)}
			onAdd={viewOnly ? undefined : () => editor?.edit()}
		/>
	</div>
</Dialog>
<NoteDraftEditor
	bind:this={editor}
	{notes}
	readonly={viewOnly}
	onSave={(note) => !viewOnly && run({ type: 'SetGameNote', ...note })}
	onDelete={(noteId) => !viewOnly && run({ type: 'DeleteGameNote', noteId })}
/>

<style>
	.notes-slot {
		display: contents;
	}
	/* Eight 44px buttons and their gaps need 412px; narrower, the board's are in More. */
	@media (max-width: 411.98px) {
		.notes-slot.on-board {
			display: none;
		}
	}
</style>

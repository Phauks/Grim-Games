<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import RoomVote from './RoomVote.svelte';
	import type { VotePick } from './vote-pick.ts';

	/**
	 * The room vote over the board (Trevor, 2026-11-01: a room vote after the game "should not
	 * require leaving the game screen"). It fills the screen, as /vote does (Trevor, 2026-10-26:
	 * "its own screen. Not a popup"), so a stray tap can't close it, and blurs what is behind it
	 * because the room's code and QR are shown to the table. X keeps an open vote running.
	 */
	interface Props {
		open: boolean;
		/** Play: the board's New game with the winner chosen. */
		onPlay: (pick: VotePick) => void;
	}
	let { open = $bindable(), onPlay }: Props = $props();
</script>

<Dialog bind:open title={t('room.scriptVote.button')} size="screen" shownToPlayers>
	<RoomVote
		hideBack
		onPlay={(pick) => {
			open = false;
			onPlay(pick);
		}}
		onBack={() => (open = false)}
	/>
</Dialog>

<script lang="ts">
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { playersDialog } from './players-dialog.svelte.ts';
	import PlayersPanel from './PlayersPanel.svelte';

	/** Players over the board, from ⋯ on every screen, so the Storyteller never leaves the game. */
	let { game }: { game: OpenGame } = $props();
</script>

<Dialog bind:open={playersDialog.open} title={t('room.players.title')} size="full">
	<PlayersPanel {game} />
</Dialog>

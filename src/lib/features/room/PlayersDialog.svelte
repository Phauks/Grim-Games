<script lang="ts">
	import type { Command } from '#lib/core/engine/index.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { playersDialog } from './players-dialog.svelte.ts';
	import PlayersPanel from './PlayersPanel.svelte';
	import CountOffDialog from './CountOffDialog.svelte';
	import TravellerPickDialog from './TravellerPickDialog.svelte';

	/** Players over the board, from ⋯ on every screen, so the Storyteller never leaves the game. */
	let { game, run }: { game: OpenGame; run?: (command: Command) => boolean } = $props();
</script>

<Dialog bind:open={playersDialog.open} title={t('room.players.title')} size="full">
	<PlayersPanel {game} {run} />
</Dialog>
<CountOffDialog {game} {run} />
<TravellerPickDialog {game} {run} />

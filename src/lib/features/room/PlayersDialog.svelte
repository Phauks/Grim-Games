<script lang="ts">
	import type { Command } from '#lib/core/engine/index.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { playersDialog } from './players-dialog.svelte.ts';
	import PlayersPanel from './PlayersPanel.svelte';
	import ShowRolesButton from './ShowRolesButton.svelte';
	import CountOffDialog from './CountOffDialog.svelte';

	/** Players over the board, from ⋯ on every screen, so the Storyteller never leaves the game. */
	let { game, run }: { game: OpenGame; run?: (command: Command) => boolean } = $props();
</script>

<Dialog bind:open={playersDialog.open} title={t('room.players.title')} size="full">
	{#snippet headActions()}<ShowRolesButton {game} />{/snippet}
	<PlayersPanel {game} {run} />
</Dialog>
<CountOffDialog {game} {run} />

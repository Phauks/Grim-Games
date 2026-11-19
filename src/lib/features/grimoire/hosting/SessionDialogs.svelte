<script lang="ts">
	import { gameSettings } from '#lib/features/game-settings/game-settings.svelte.ts';
	import GameSettingsDialog from '#lib/features/game-settings/GameSettingsDialog.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import RoomTransferDialog from './RoomTransferDialog.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import { sessionDialogs } from './session-dialogs.svelte.ts';

	/** The dialogs More's Session opens, kept with the board (session-dialogs.svelte.ts). */
	const gameId = $derived(gameSettings.gameId);
</script>

{#if gameId}<GameSettingsDialog bind:open={sessionDialogs.gameSettings} {gameId} />{/if}

<RoomTransferDialog bind:open={sessionDialogs.transfer} />

<!-- Close room deletes the room and sends every phone out (Trevor, 2026-10-26). -->
<ConfirmDialog
	bind:open={sessionDialogs.closeRoom}
	title={t('room.closeRoomTitle')}
	danger
	onConfirm={() => roomHost().close()}
>
	<p class="dialog-text">{t('room.closeRoomText')}</p>
</ConfirmDialog>

<style>
	.dialog-text {
		margin: 0;
	}
</style>

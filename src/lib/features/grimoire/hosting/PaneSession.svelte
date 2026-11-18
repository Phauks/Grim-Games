<script lang="ts">
	import { gameSettings } from '#lib/features/game-settings/game-settings.svelte.ts';
	import GameSettingsDialog from '#lib/features/game-settings/GameSettingsDialog.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { roomTransfer } from '#lib/features/room/room-transfer.svelte.ts';
	import RoomTransferDialog from '#lib/features/grimoire/hosting/RoomTransferDialog.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';

	/**
	 * More's Session (Trevor, 2026-10-30: "pre and post game"; moved from the board's ⋯ menu into
	 * the pane, 2026-11-18): this game's settings and info, then its start and end. Items that
	 * can't be used now are left out, not greyed (Trevor, 2026-10-27).
	 */
	interface Props {
		/** Game info is here only while the board's corner is hidden. */
		gameInfo: boolean;
		/** An ended game offers Reopen and New game in place of End game. */
		ended: boolean;
		onGameInfo: () => void;
		/** Back to Character selection; only until Start game (Trevor, 2026-10-24). */
		onCharacterSelection?: () => void;
		/** The draw's Add late player once the draw is done, until Start game. */
		onLatePlayer?: () => void;
		onReopen: () => void;
		/** New game, which asks to end this one first. */
		newGame?: { begin(): void };
		/** Close room, once the game has ended and while its room is open. Asks first. */
		onCloseRoom?: () => void;
		onEnd: () => void;
	}

	let {
		gameInfo,
		ended,
		onGameInfo,
		onCharacterSelection,
		onLatePlayer,
		onReopen,
		newGame,
		onCloseRoom,
		onEnd
	}: Props = $props();

	const host = roomHost();
	const gameId = $derived(gameSettings.gameId);
	let gameSettingsOpen = $state(false);
	let closeRoomOpen = $state(false);
	let transferOpen = $state(false);
	/** Opens the transfer's codes, starting a transfer when none is open. */
	async function openTransfer() {
		const transfer = roomTransfer();
		if (!transfer.code && !(await transfer.start())) toast(t('room.transfer.failed'));
		else transferOpen = true;
	}
</script>

<div class="items" data-testid="pane-session">
	{#if gameId}
		<Button variant="quiet" icon="settings" onclick={() => (gameSettingsOpen = true)}>
			{t('setup.gameSettings')}
		</Button>
	{/if}
	{#if gameInfo}
		<Button variant="quiet" icon="info" onclick={onGameInfo}>Game info</Button>
	{/if}
	{#if onCharacterSelection}
		<Button variant="quiet" icon="bag" onclick={onCharacterSelection}>
			{t('setup.characterSelection')}
		</Button>
	{/if}
	{#if onLatePlayer}
		<Button variant="quiet" icon="latePlayer" data-testid="menu-late-player" onclick={onLatePlayer}>
			{t('late-player.button')}
		</Button>
	{/if}
	{#if ended}
		<Button variant="quiet" icon="undo" onclick={onReopen}>Reopen game</Button>
	{/if}
	<!-- Room transfer above End game (Trevor, 2026-10-30), only while the room is connected. -->
	{#if host.status === 'open'}
		<Button
			variant="quiet"
			icon="transfer"
			data-testid="menu-transfer"
			onclick={() => void openTransfer()}
		>
			{t('room.transfer.button')}
		</Button>
	{/if}
	<!-- New game takes End game's place once the game has ended (Trevor, 2026-10-26). -->
	{#if !ended}
		<Button variant="danger" icon="close" onclick={onEnd}>End game</Button>
	{:else if newGame}
		<Button variant="quiet" icon="add" onclick={() => newGame.begin()}>
			{t('setup.newGame')}
		</Button>
	{/if}
	{#if ended && onCloseRoom}
		<Button variant="danger" icon="close" onclick={() => (closeRoomOpen = true)}>
			{t('room.closeRoom')}
		</Button>
	{/if}
</div>

{#if gameId}<GameSettingsDialog bind:open={gameSettingsOpen} {gameId} />{/if}

<RoomTransferDialog bind:open={transferOpen} />

<ConfirmDialog
	bind:open={closeRoomOpen}
	title={t('room.closeRoomTitle')}
	danger
	onConfirm={() => onCloseRoom?.()}
>
	<p class="dialog-text">{t('room.closeRoomText')}</p>
</ConfirmDialog>

<style>
	.items {
		display: grid;
		align-content: start;
		gap: var(--space-2);
		padding-inline: var(--pane-gutter, 0rem);
	}
	.dialog-text {
		margin: 0;
	}
</style>

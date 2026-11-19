<script lang="ts">
	import { gameSettings } from '#lib/features/game-settings/game-settings.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { roomTransfer } from '#lib/features/room/room-transfer.svelte.ts';
	import { sessionDialogs } from './session-dialogs.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { sidePane } from '#lib/features/room/side-pane.svelte.ts';
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
		onEnd
	}: Props = $props();

	/** A phone's sheet closes first, so what the item opens or starts is on the board. */
	function act(action: () => void) {
		sidePane.hide();
		action();
	}

	const host = roomHost();
	const gameId = $derived(gameSettings.gameId);
	/** Opens the transfer's codes, starting a transfer when none is open. */
	async function openTransfer() {
		const transfer = roomTransfer();
		if (!transfer.code && !(await transfer.start())) toast(t('room.transfer.failed'));
		else sessionDialogs.transfer = true;
	}
</script>

<div class="items" data-testid="pane-session">
	{#if gameId}
		<Button
			variant="quiet"
			icon="settings"
			onclick={() => act(() => (sessionDialogs.gameSettings = true))}
		>
			{t('setup.gameSettings')}
		</Button>
	{/if}
	{#if gameInfo}
		<Button variant="quiet" icon="info" onclick={() => act(onGameInfo)}>Game info</Button>
	{/if}
	{#if onCharacterSelection}
		<Button variant="quiet" icon="bag" onclick={() => act(onCharacterSelection)}>
			{t('setup.characterSelection')}
		</Button>
	{/if}
	{#if onLatePlayer}
		<Button
			variant="quiet"
			icon="latePlayer"
			data-testid="menu-late-player"
			onclick={() => act(onLatePlayer)}
		>
			{t('late-player.button')}
		</Button>
	{/if}
	{#if ended}
		<Button variant="quiet" icon="undo" onclick={() => act(onReopen)}>Reopen game</Button>
	{/if}
	<!-- Room transfer above End game (Trevor, 2026-10-30), only while the room is connected. -->
	{#if host.status === 'open'}
		<Button
			variant="quiet"
			icon="transfer"
			data-testid="menu-transfer"
			onclick={() => act(() => void openTransfer())}
		>
			{t('room.transfer.button')}
		</Button>
	{/if}
	<!-- New game takes End game's place once the game has ended (Trevor, 2026-10-26). -->
	{#if !ended}
		<Button variant="danger" icon="close" onclick={() => act(onEnd)}>End game</Button>
	{:else if newGame}
		<Button variant="quiet" icon="add" onclick={() => act(() => newGame.begin())}>
			{t('setup.newGame')}
		</Button>
	{/if}
	<!-- Close room once the game has ended, while its room is open (Trevor, 2026-10-26). -->
	{#if ended && host.code}
		<Button
			variant="danger"
			icon="close"
			onclick={() => act(() => (sessionDialogs.closeRoom = true))}
		>
			{t('room.closeRoom')}
		</Button>
	{/if}
</div>

<style>
	.items {
		display: grid;
		align-content: start;
		gap: var(--space-2);
		padding-inline: var(--pane-gutter, 0rem);
	}
</style>

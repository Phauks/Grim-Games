<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { reportWithDiagnostics } from '#lib/features/errors/report-with-diagnostics.ts';
	import { settingsDialog } from '#lib/features/settings/settings-dialog.svelte.ts';
	import { navDrawer } from '#lib/features/shell/nav-drawer.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';

	/**
	 * The board's ⋯ menu: the game's less frequent actions, the seats, the board's settings,
	 * the app's items, then End game (New game once it has ended). Each item closes the menu before it acts.
	 */
	interface Props {
		open: boolean;
		/** Game info is here only while the board's corner is hidden. */
		gameInfo: boolean;
		/** An ended game offers Export and Reopen in place of End game. */
		ended: boolean;
		onHistory: () => void;
		onBluffs: () => void;
		onNotes: () => void;
		/** Back to town (plan U2): only while players' phones can be in a room. */
		onCallTown?: () => void;
		onGameInfo: () => void;
		/** Back to Character selection; only until Start game (Trevor, 2026-10-24). */
		onCharacterSelection?: () => void;
		onAddSeat: () => void;
		onAddRule: () => void;
		onArrange: () => void;
		onExport: () => void;
		/** Players' feedback on the ended game; not for a spectator's board. */
		onFeedback?: () => void;
		onReopen: () => void;
		/** New game, which asks to end this one first; not on a spectator's board. */
		onNewGame?: () => void;
		/**
		 * Close room, once the game has ended and while its room is open (Trevor, 2026-10-26):
		 * deletes the room and sends every phone out. Asks first.
		 */
		onCloseRoom?: () => void;
		onEnd: () => void;
	}

	let {
		open = $bindable(),
		gameInfo,
		ended,
		onHistory,
		onBluffs,
		onNotes,
		onCallTown,
		onGameInfo,
		onCharacterSelection,
		onAddSeat,
		onAddRule,
		onArrange,
		onExport,
		onFeedback,
		onReopen,
		onNewGame,
		onCloseRoom,
		onEnd
	}: Props = $props();
	let closeRoomOpen = $state(false);

	function fromMenu(action: () => void) {
		open = false;
		action();
	}
	/** The grim cover (Trevor, 2026-10-26), as the day sheet's own (CoverButton). */
	let covering = $state(false);
</script>

<Dialog bind:open title="Grimoire">
	<div class="menu">
		<Button variant="quiet" icon="history" onclick={() => fromMenu(onHistory)}>History</Button>
		<Button variant="quiet" icon="demon" onclick={() => fromMenu(onBluffs)}>Demon bluffs</Button>
		<Button variant="quiet" icon="notes" onclick={() => fromMenu(onNotes)}>Notes</Button>
		<Button variant="quiet" icon="cover" onclick={() => fromMenu(() => (covering = true))}>
			{t('show.cover')}
		</Button>
		{#if onCallTown}
			<!-- Every phone in the room sounds and vibrates (plan U2, Trevor 2026-10-26). -->
			<Button variant="quiet" icon="sound" onclick={() => fromMenu(onCallTown)}>
				{t('room.callTown')}
			</Button>
		{/if}
		{#if gameInfo}
			<Button variant="quiet" icon="info" onclick={() => fromMenu(onGameInfo)}>Game info</Button>
		{/if}
		{#if onCharacterSelection}
			<Button variant="quiet" icon="bag" onclick={() => fromMenu(onCharacterSelection)}>
				{t('setup.characterSelection')}
			</Button>
		{/if}
		<!-- Lines set the seats, then the settings, apart from the rest of the game, and End game
		     apart at the bottom (Trevor, 2026-10-18). -->
		<hr class="menu-rule" />
		<Button variant="quiet" icon="add" onclick={() => fromMenu(onAddSeat)}>Add seat</Button>
		<Button variant="quiet" icon="fabled" onclick={() => fromMenu(onAddRule)}>
			Add Fabled or Loric
		</Button>
		<Button variant="quiet" icon="arrange" onclick={() => fromMenu(onArrange)}>
			Arrange seats
		</Button>
		<hr class="menu-rule" />
		<!-- Board and token settings over the board (Trevor, 2026-10-17); two sections since
		     2026-10-18. -->
		<Button
			variant="quiet"
			icon="boardSettings"
			onclick={() => fromMenu(() => settingsDialog.showOnly('board'))}
		>
			Board
		</Button>
		<Button
			variant="quiet"
			icon="tokenSettings"
			onclick={() => fromMenu(() => settingsDialog.showOnly('tokens'))}
		>
			Tokens
		</Button>
		<!-- The board's settings apart from the app's items (Trevor, 2026-10-23). -->
		<hr class="menu-rule" />
		<!-- Leaving is through the app's navigation, which asks first (Trevor, 2026-10-16). -->
		<span class="menu-nav">
			<Button variant="quiet" icon="menu" onclick={() => fromMenu(() => navDrawer.show())}>
				Navigation
			</Button>
		</span>
		<!-- The one Report form, straight from the game (Trevor, 2026-10-20). -->
		<Button
			variant="quiet"
			icon="report"
			onclick={() => fromMenu(() => void reportWithDiagnostics())}
		>
			{t('shell.reportIssue')}
		</Button>
		<hr class="menu-rule" />
		<!-- Leaving keeps the game to come back to; End moves it to History (Trevor, 2026-10-16). -->
		{#if ended}
			<Button variant="quiet" icon="download" onclick={() => fromMenu(onExport)}>
				Export game
			</Button>
			{#if onFeedback}
				<Button variant="quiet" icon="feedback" onclick={() => fromMenu(onFeedback)}>
					{t('room.feedback.view')}
				</Button>
			{/if}
			<Button variant="quiet" icon="undo" onclick={() => fromMenu(onReopen)}>Reopen game</Button>
		{/if}
		<!-- New game takes End game's place once the game has ended (Trevor, 2026-10-26). -->
		{#if !ended}
			<Button variant="danger" icon="close" onclick={() => fromMenu(onEnd)}>End game</Button>
		{:else if onNewGame}
			<Button variant="quiet" icon="add" onclick={() => fromMenu(onNewGame)}>
				{t('setup.newGame')}
			</Button>
		{/if}
		{#if ended && onCloseRoom}
			<Button variant="danger" icon="close" onclick={() => fromMenu(() => (closeRoomOpen = true))}>
				{t('room.closeRoom')}
			</Button>
		{/if}
	</div>
</Dialog>
<ShowToPlayer bind:open={covering} blank />

<ConfirmDialog
	bind:open={closeRoomOpen}
	title={t('room.closeRoomTitle')}
	danger
	onConfirm={() => onCloseRoom?.()}
>
	<p class="dialog-text">{t('room.closeRoomText')}</p>
</ConfirmDialog>

<style>
	.dialog-text {
		margin: 0;
	}
	.menu {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
	.menu-rule {
		width: 100%;
		margin: 0;
		border: 0;
		/* The menu buttons' border colour, thicker so the sections read at a glance (Trevor,
		   2026-10-19). */
		border-top: 0.125rem solid var(--button-edge);
	}
	.menu-nav {
		display: none;
	}
	/* The narrowest phones keep the app's navigation here instead of on the toolbar. */
	@media (max-width: 359.98px) {
		.menu-nav {
			display: contents;
		}
	}
</style>

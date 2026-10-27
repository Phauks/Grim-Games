<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { reportWithDiagnostics } from '#lib/features/errors/report-with-diagnostics.ts';
	import { settingsDialog } from '#lib/features/settings/settings-dialog.svelte.ts';
	import { navDrawer } from '#lib/features/shell/nav-drawer.svelte.ts';
	import { appFullScreen } from '#lib/ui/full-screen.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	/**
	 * The board's ⋯ menu in named groups: the game's less frequent actions ending with End
	 * game (New game once it has ended), the seats, and the app's items with all of Settings.
	 * Each item closes the menu before it acts.
	 */
	interface Props {
		open: boolean;
		/**
		 * A spectator's board (an admin's, Trevor 2026-10-27): History, Game info and the app's
		 * items work; every other item shows, disabled, as the board's own controls do.
		 */
		watching?: boolean;
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
		watching = false,
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
</script>

<!-- Named groups, in two columns on a tablet or computer (Trevor, 2026-10-27: "the delineation
     is nice"): the game on the left, with End game or New game at its foot ("end game/new game
     should be under game"); seats and the app's items on the right. -->
<Dialog bind:open title="Grimoire" size="wide">
	<div class="menu">
		<section class="group" aria-labelledby="board-menu-game">
			<h3 id="board-menu-game" class="group-title">Game</h3>
			<Button variant="quiet" icon="history" onclick={() => fromMenu(onHistory)}>History</Button>
			<Button disabled={watching} variant="quiet" icon="demon" onclick={() => fromMenu(onBluffs)}
				>Demon bluffs</Button
			>
			<Button disabled={watching} variant="quiet" icon="notes" onclick={() => fromMenu(onNotes)}
				>Notes</Button
			>
			{#if onCallTown}
				<!-- Every phone in the room sounds and vibrates (plan U2, Trevor 2026-10-26). -->
				<Button
					disabled={watching}
					variant="quiet"
					icon="sound"
					onclick={() => fromMenu(onCallTown)}
				>
					{t('room.callTown')}
				</Button>
			{/if}
			{#if gameInfo}
				<Button variant="quiet" icon="info" onclick={() => fromMenu(onGameInfo)}>Game info</Button>
			{/if}
			{#if onCharacterSelection}
				<Button
					disabled={watching}
					variant="quiet"
					icon="bag"
					onclick={() => fromMenu(onCharacterSelection)}
				>
					{t('setup.characterSelection')}
				</Button>
			{/if}
			<!-- Leaving keeps the game to come back to; End moves it to History (Trevor, 2026-10-16). -->
			{#if ended}
				<Button
					disabled={watching}
					variant="quiet"
					icon="download"
					onclick={() => fromMenu(onExport)}
				>
					Export game
				</Button>
				{#if onFeedback}
					<Button
						disabled={watching}
						variant="quiet"
						icon="feedback"
						onclick={() => fromMenu(onFeedback)}
					>
						{t('room.feedback.view')}
					</Button>
				{/if}
				<Button disabled={watching} variant="quiet" icon="undo" onclick={() => fromMenu(onReopen)}
					>Reopen game</Button
				>
			{/if}
			<!-- New game takes End game's place once the game has ended (Trevor, 2026-10-26). -->
			{#if !ended}
				<Button disabled={watching} variant="danger" icon="close" onclick={() => fromMenu(onEnd)}
					>End game</Button
				>
			{:else if onNewGame}
				<Button disabled={watching} variant="quiet" icon="add" onclick={() => fromMenu(onNewGame)}>
					{t('setup.newGame')}
				</Button>
			{/if}
			{#if ended && onCloseRoom}
				<Button
					disabled={watching}
					variant="danger"
					icon="close"
					onclick={() => fromMenu(() => (closeRoomOpen = true))}
				>
					{t('room.closeRoom')}
				</Button>
			{/if}
		</section>
		<div class="column">
			<section class="group" aria-labelledby="board-menu-seats">
				<h3 id="board-menu-seats" class="group-title">Seats</h3>
				<Button disabled={watching} variant="quiet" icon="add" onclick={() => fromMenu(onAddSeat)}
					>Add seat</Button
				>
				<Button
					disabled={watching}
					variant="quiet"
					icon="fabled"
					onclick={() => fromMenu(onAddRule)}
				>
					Add Fabled or Loric
				</Button>
				<Button
					disabled={watching}
					variant="quiet"
					icon="arrange"
					onclick={() => fromMenu(onArrange)}
				>
					Arrange seats
				</Button>
			</section>
			<section class="group" aria-labelledby="board-menu-app">
				<h3 id="board-menu-app" class="group-title">App</h3>
				<!-- All of Settings, not only the board's sections (Trevor, 2026-10-27: "why not just
				     open to all settings, and stop limiting to what they can access?"), at Board. -->
				<Button
					disabled={watching}
					variant="quiet"
					icon="settings"
					onclick={() => fromMenu(() => settingsDialog.show('board'))}
				>
					{t('settings.title')}
				</Button>
				<!-- Here, not on the toolbar, so the grim cover can sit beside ☰ (Trevor, 2026-10-27).
				     The symbol says on or off; where the browser can't, it isn't listed. -->
				{#if appFullScreen.available}
					<Button
						variant="quiet"
						icon={appFullScreen.on ? 'exitFullScreen' : 'fullScreen'}
						aria-pressed={appFullScreen.on}
						onclick={() => fromMenu(() => appFullScreen.toggle())}
					>
						Full screen
					</Button>
				{/if}
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
			</section>
		</div>
	</div>
</Dialog>

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
		gap: var(--space-4);
		margin-top: var(--space-3);
	}
	.group {
		display: grid;
		align-content: start;
		gap: var(--space-2);
	}
	/* As a heading over a run of settings (SettingHeading). */
	.group-title {
		margin: 0;
		font-family: var(--font-control);
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--on-surface-muted);
	}
	/* On a phone, one column in the same order. */
	.column {
		display: contents;
	}
	@media (min-width: 40rem) {
		.menu {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			column-gap: var(--space-5);
		}
		.column {
			display: grid;
			align-content: start;
			gap: var(--space-4);
		}
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

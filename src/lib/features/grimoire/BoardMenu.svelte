<script lang="ts">
	import { gameSettings } from '#lib/features/game-settings/game-settings.svelte.ts';
	import GameSettingsDialog from '#lib/features/game-settings/GameSettingsDialog.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { reportWithDiagnostics } from '#lib/features/errors/report-with-diagnostics.ts';
	import { settingsDialog } from '#lib/features/settings/settings-dialog.svelte.ts';
	import { navDrawer } from '#lib/features/shell/nav-drawer.svelte.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { appFullScreen } from '#lib/ui/full-screen.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import RoomTransferDialog from '#lib/features/grimoire/hosting/RoomTransferDialog.svelte';
	import { roomTransfer } from '#lib/features/room/room-transfer.svelte.ts';

	/**
	 * The board's ⋯ menu in named groups: the game's less frequent actions, its start and end
	 * (Character selection, End game, and New game once it has ended), the seats, and the app's
	 * items with all of Settings.
	 * Each item closes the menu before it acts. Full screen is an icon beside the menu's X, and
	 * leaves it open.
	 */
	interface Props {
		open: boolean;
		/**
		 * A spectator's board (an admin's, Trevor 2026-10-27; anyone watching the grim, 2026-11-15:
		 * "they should be able to see lunatic bluffs"): History, Demon bluffs (read-only), Game
		 * info and the app's items. The Storyteller's own items (Players, Game notes, Game
		 * settings, Seats, Session) are left out, since a spectator never has them.
		 */
		watching?: boolean;
		/** Game info is here only while the board's corner is hidden. */
		gameInfo: boolean;
		/**
		 * An ended game offers Reopen and New game in place of End game; Share grim, Export
		 * and Player feedback are on the board's Game over (Trevor, 2026-11-15).
		 */
		ended: boolean;
		onHistory: () => void;
		/** Undefined in a mode where the Demon gets no bluffs (Sushi Buffet, Whale Buffet). */
		onBluffs?: () => void;
		/** Info tokens, from the toolbar; in here only on the narrowest phones. */
		onInfo?: () => void;
		/**
		 * The Soundboard (plan U6), a full row in the game's items (Trevor, 2026-11-01: "a full
		 * button"); not on a spectator's board. Back to town is on the day timer.
		 */
		onSoundboard?: () => void;
		onGameInfo: () => void;
		/** Back to Character selection; only until Start game (Trevor, 2026-10-24). */
		onCharacterSelection?: () => void;
		/**
		 * The draw's Add late player once the draw is done, until Start game (Trevor,
		 * 2026-11-15): in Session, as it is only there before the game starts.
		 */
		onLatePlayer?: () => void;
		onAddRule: () => void;
		onArrange: () => void;
		onReopen: () => void;
		/**
		 * The board's New game sheet, not on a spectator's board: New game, which asks to end
		 * this one first. The room's vote on the next game is New game's own Room vote, not an
		 * item here (Trevor, 2026-11-15: it "is already in the new game area").
		 */
		newGame?: { begin(): void };
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
		onInfo,
		onSoundboard,
		onGameInfo,
		onCharacterSelection,
		onLatePlayer,
		onAddRule,
		onArrange,
		onReopen,
		newGame,
		onCloseRoom,
		onEnd
	}: Props = $props();
	let closeRoomOpen = $state(false);
	/** Opens the transfer's codes, starting a transfer when none is open. */
	let transferOpen = $state(false);
	async function openTransfer() {
		const transfer = roomTransfer();
		if (!transfer.code && !(await transfer.start())) toast(t('room.transfer.failed'));
		else transferOpen = true;
	}
	let gameSettingsOpen = $state(false);
	const gameId = $derived(gameSettings.gameId);
	const host = roomHost();

	function fromMenu(action: () => void) {
		open = false;
		action();
	}
</script>

<!-- Named groups, in two columns on a tablet or computer (Trevor, 2026-10-27: "the delineation
     is nice"): the game with its seats under it on the left ("seats should go below game"), the
     app's items then the session's start and end on the right. On a phone, one column: Game,
     Seats, App, Session (Trevor, 2026-11-03). -->
<Dialog bind:open title="Grimoire" size="wide">
	<!-- An icon beside X, not a menu item (Trevor, 2026-10-31: "instead of full screen being its
	     own button in the menu, put it as an icon next to the x button"). The symbol says on or
	     off; where the browser can't, it isn't there. It leaves the menu open (Trevor,
	     2026-10-27: "dont close ... menu when toggling fullscreen"). -->
	{#snippet headActions()}
		{#if appFullScreen.available}
			<IconButton
				icon={appFullScreen.on ? 'exitFullScreen' : 'fullScreen'}
				label="Full screen"
				aria-pressed={appFullScreen.on}
				onclick={() => appFullScreen.toggle()}
			/>
		{/if}
	{/snippet}
	<div class="menu">
		<div class="column">
			<section class="group" aria-labelledby="board-menu-game">
				<h3 id="board-menu-game" class="group-title">Game</h3>
				<!-- The toolbar's Info tokens, here on the narrowest phones so the pane's button stays
				     by the grim cover (Trevor, 2026-11-15). Players and Game notes are in that pane. -->
				{#if !watching}<span class="narrow-only"
						><Button
							disabled={!onInfo}
							variant="quiet"
							icon="info"
							data-testid="menu-info-tokens"
							onclick={() => onInfo && fromMenu(onInfo)}>Info tokens</Button
						></span
					>{/if}
				<Button variant="quiet" icon="history" onclick={() => fromMenu(onHistory)}>History</Button>
				<Button
					disabled={!onBluffs}
					variant="quiet"
					icon="demon"
					data-testid="menu-bluffs"
					onclick={() => onBluffs && fromMenu(onBluffs)}>Demon bluffs</Button
				>
				{#if onSoundboard}
					<Button variant="quiet" icon="soundboard" onclick={() => fromMenu(onSoundboard)}>
						{t('settings.soundboard')}
					</Button>
				{/if}
				{#if gameInfo}
					<Button variant="quiet" icon="info" onclick={() => fromMenu(onGameInfo)}>Game info</Button
					>
				{/if}
				<!-- This game's own settings, as the start flow's Game settings step set them. -->
				{#if gameId && !watching}
					<Button
						variant="quiet"
						icon="settings"
						onclick={() => fromMenu(() => (gameSettingsOpen = true))}
					>
						{t('setup.gameSettings')}
					</Button>
				{/if}
			</section>
			{#if !watching}<section class="group" aria-labelledby="board-menu-seats">
					<h3 id="board-menu-seats" class="group-title">Seats</h3>
					<!-- Add seat is in Seating's bar only (Trevor, 2026-11-01). -->
					<Button variant="quiet" icon="fabled" onclick={() => fromMenu(onAddRule)}>
						Add Fabled or Loric
					</Button>
					<!-- Seating (Trevor, 2026-10-31): arranging seats, letting phones move theirs (plan J38)
				     and Count off (J40) are one mode, with the room's parts along its bar. -->
					<Button
						variant="quiet"
						icon="arrange"
						data-testid="menu-seating"
						onclick={() => fromMenu(onArrange)}
					>
						{t('room.seating.title')}
					</Button>
				</section>{/if}
		</div>
		<div class="column">
			<section class="group" aria-labelledby="board-menu-app">
				<h3 id="board-menu-app" class="group-title">App</h3>
				<!-- All of Settings, not only the board's sections (Trevor, 2026-10-27: "why not just
				     open to all settings, and stop limiting to what they can access?"), at its root,
				     as from the navigation (Trevor, 2026-10-27: "should just go to the root"). -->
				<Button
					variant="quiet"
					icon="settings"
					onclick={() => fromMenu(() => settingsDialog.show())}
				>
					{t('settings.title')}
				</Button>
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
			<!-- Before and after the game, apart from its other items (Trevor, 2026-10-30: they "feel
			     somewhat different from the other items in game"; "these all seem related to pre and
			     post game"): Character selection until Start game, then End game, then what an ended
			     game offers. Last, below App (Trevor, 2026-11-03: "games, seats, app, session"). -->
			{#if !watching}<section class="group" aria-labelledby="board-menu-session">
					<h3 id="board-menu-session" class="group-title">Session</h3>
					{#if onCharacterSelection}
						<Button variant="quiet" icon="bag" onclick={() => fromMenu(onCharacterSelection)}>
							{t('setup.characterSelection')}
						</Button>
					{/if}
					{#if onLatePlayer}
						<Button
							variant="quiet"
							icon="latePlayer"
							data-testid="menu-late-player"
							onclick={() => fromMenu(onLatePlayer)}
						>
							{t('late-player.button')}
						</Button>
					{/if}
					<!-- Leaving keeps the game to come back to; End moves it to History (Trevor, 2026-10-16). -->
					{#if ended}
						<Button variant="quiet" icon="undo" onclick={() => fromMenu(onReopen)}
							>Reopen game</Button
						>
					{/if}
					<!-- Room transfer (Trevor, 2026-10-30: "room transfer should be above end game"),
				     moved from Share; only while the room is connected, as unavailable items hide. -->
					{#if host.status === 'open'}
						<Button
							variant="quiet"
							icon="transfer"
							data-testid="menu-transfer"
							onclick={() => fromMenu(() => void openTransfer())}
						>
							{t('room.transfer.button')}
						</Button>
					{/if}
					<!-- New game takes End game's place once the game has ended (Trevor, 2026-10-26). -->
					{#if !ended}
						<Button variant="danger" icon="close" onclick={() => fromMenu(onEnd)}>End game</Button>
					{:else if newGame}
						<Button variant="quiet" icon="add" onclick={() => fromMenu(() => newGame.begin())}>
							{t('setup.newGame')}
						</Button>
					{/if}
					{#if ended && onCloseRoom}
						<Button
							variant="danger"
							icon="close"
							onclick={() => fromMenu(() => (closeRoomOpen = true))}
						>
							{t('room.closeRoom')}
						</Button>
					{/if}
				</section>{/if}
		</div>
	</div>
</Dialog>

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
	.narrow-only {
		display: none;
	}
	/* The toolbar's breakpoint for Info tokens: below it, Info tokens are only here. */
	@media (max-width: 411.98px) {
		.narrow-only {
			display: contents;
		}
	}
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

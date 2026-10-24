<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { reportWithDiagnostics } from '#lib/features/errors/report-with-diagnostics.ts';
	import { settingsDialog } from '#lib/features/settings/settings-dialog.svelte.ts';
	import { navDrawer } from '#lib/features/shell/nav-drawer.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	/**
	 * The board's ⋯ menu: the game's less frequent actions, the seats, the board's settings,
	 * the app's items, then End game. Each item closes the menu before it acts.
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
		onGameInfo: () => void;
		onAddSeat: () => void;
		onAddRule: () => void;
		onArrange: () => void;
		onExport: () => void;
		onReopen: () => void;
		onEnd: () => void;
	}

	let {
		open = $bindable(),
		gameInfo,
		ended,
		onHistory,
		onBluffs,
		onNotes,
		onGameInfo,
		onAddSeat,
		onAddRule,
		onArrange,
		onExport,
		onReopen,
		onEnd
	}: Props = $props();

	function fromMenu(action: () => void) {
		open = false;
		action();
	}
</script>

<Dialog bind:open title="Grimoire">
	<div class="menu">
		<Button variant="quiet" icon="history" onclick={() => fromMenu(onHistory)}>History</Button>
		<Button variant="quiet" icon="demon" onclick={() => fromMenu(onBluffs)}>Demon bluffs</Button>
		<Button variant="quiet" icon="notes" onclick={() => fromMenu(onNotes)}>Notes</Button>
		{#if gameInfo}
			<Button variant="quiet" icon="info" onclick={() => fromMenu(onGameInfo)}>Game info</Button>
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
			<Button variant="quiet" icon="undo" onclick={() => fromMenu(onReopen)}>Reopen game</Button>
		{:else}
			<Button variant="danger" icon="close" onclick={() => fromMenu(onEnd)}>End game</Button>
		{/if}
	</div>
</Dialog>

<style>
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

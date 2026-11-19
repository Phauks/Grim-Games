<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { reportWithDiagnostics } from '#lib/features/errors/report-with-diagnostics.ts';
	import { settingsDialog } from '#lib/features/settings/settings-dialog.svelte.ts';
	import { appFullScreen } from '#lib/ui/full-screen.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import HistoryDialog from './HistoryDialog.svelte';

	/**
	 * A spectator's ⋯ menu (an admin's, Trevor 2026-10-27; anyone watching the grim, 2026-11-15:
	 * "they should be able to see lunatic bluffs"): History, Demon bluffs (read-only), Game info
	 * and Settings. The Storyteller's board has none: its items are views of the pane's More
	 * (Trevor, 2026-11-18). Each item closes the menu before it acts.
	 */
	interface Props {
		open: boolean;
		grimoire: Grimoire;
		/** Game info is here only while the board's corner is hidden. */
		gameInfo: boolean;
		/** Undefined in a mode where the Demon gets no bluffs (Sushi Buffet, Whale Buffet). */
		onBluffs?: () => void;
		onGameInfo: () => void;
	}

	let { open = $bindable(), grimoire, gameInfo, onBluffs, onGameInfo }: Props = $props();
	let historyOpen = $state(false);

	function fromMenu(action: () => void) {
		open = false;
		action();
	}
</script>

<Dialog bind:open title="Grimoire">
	<!-- Full screen and Report an issue as icons beside X (Trevor, 2026-10-31; 2026-11-16). -->
	{#snippet headActions()}
		{#if appFullScreen.available}
			<IconButton
				icon={appFullScreen.on ? 'exitFullScreen' : 'fullScreen'}
				label="Full screen"
				aria-pressed={appFullScreen.on}
				onclick={() => appFullScreen.toggle()}
			/>
		{/if}
		<IconButton
			icon="report"
			label={t('shell.reportIssue')}
			onclick={() => fromMenu(() => void reportWithDiagnostics())}
		/>
	{/snippet}
	<div class="menu">
		<Button variant="quiet" icon="history" onclick={() => fromMenu(() => (historyOpen = true))}
			>History</Button
		>
		<Button
			disabled={!onBluffs}
			variant="quiet"
			icon="demon"
			data-testid="menu-bluffs"
			onclick={() => onBluffs && fromMenu(onBluffs)}>Demon bluffs</Button
		>
		{#if gameInfo}
			<Button variant="quiet" icon="info" onclick={() => fromMenu(onGameInfo)}>Game info</Button>
		{/if}
		<Button variant="quiet" icon="settings" onclick={() => fromMenu(() => settingsDialog.show())}>
			{t('settings.title')}
		</Button>
	</div>
</Dialog>

<HistoryDialog bind:open={historyOpen} {grimoire} />

<style>
	.menu {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
</style>

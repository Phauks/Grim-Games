<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import GameSettingsRows from './GameSettingsRows.svelte';

	/** The board's Game settings (⋯ › Game): the start flow's rows, for this game only. */
	let { open = $bindable(false), gameId }: { open?: boolean; gameId: string } = $props();
</script>

<Dialog bind:open title={t('setup.gameSettings')}>
	<div class="rows" data-testid="game-settings"><GameSettingsRows {gameId} /></div>
</Dialog>

<style>
	.rows {
		display: grid;
	}
</style>

<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import GameSettingsRows from './GameSettingsRows.svelte';

	interface Props {
		open?: boolean;
		gameId: string;
	}

	/** One game's settings: the board's ⋯ › Game, and Character selection's Game settings. */
	let { open = $bindable(false), gameId }: Props = $props();
</script>

<Dialog bind:open title={t('setup.gameSettings')}>
	<div class="rows" data-testid="game-settings">
		<GameSettingsRows {gameId} />
	</div>
</Dialog>

<style>
	.rows {
		display: grid;
	}
</style>

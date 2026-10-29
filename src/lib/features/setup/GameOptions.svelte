<script lang="ts">
	import { untrack } from 'svelte';
	import type { Game } from '#lib/core/model/index.ts';
	import GameSettingsDialog from '#lib/features/game-settings/GameSettingsDialog.svelte';
	import { seedStartSettings } from '#lib/features/game-settings/start-settings.ts';
	import { notBegun } from '#lib/features/modes/new-game-draft.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';

	/**
	 * The game's own options at the top of Character selection (Trevor, 2026-10-29: "condense
	 * three screens into one"): Game settings opens over the screen, with the settings profile
	 * the game starts with while it hasn't begun. It is no longer a start-flow step.
	 */
	let { game }: { game: Game | undefined } = $props();

	let open = $state(false);
	const starting = $derived(game ? notBegun(game) : false);

	$effect(() => {
		const gameId = game && starting ? game.gameId : undefined;
		if (gameId) untrack(() => seedStartSettings(gameId));
	});
</script>

<div class="game-options" data-testid="game-options">
	<Button variant="field" icon="settings" disabled={!game} onclick={() => (open = true)}>
		{t('setup.gameSettings')}
	</Button>
</div>

{#if game}
	<GameSettingsDialog bind:open gameId={game.gameId} profile={starting} />
{/if}

<style>
	.game-options {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
	}
</style>

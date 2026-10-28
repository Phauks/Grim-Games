<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { dealTitle } from '#lib/features/modes/deal-title.ts';
	import { backToNewGame } from '#lib/features/modes/new-game-draft.ts';
	import { afterGameSettings, stepBeforeGameSettings } from '#lib/features/modes/start.ts';
	import { settingsProfiles } from '#lib/features/settings/profiles/settings-profiles.svelte.ts';
	import type { SetupGamePort } from '#lib/features/setup/game-port.ts';
	import SetupNav from '#lib/features/setup/SetupNav.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { gameSettings } from './game-settings.svelte.ts';
	import GameSettingsRows from './GameSettingsRows.svelte';

	/**
	 * The start flow's Game settings step (Trevor, 2026-10-28: its own step, after Special
	 * rules): New game → Special rules → Game settings → Character selection (or a mode's deal).
	 * The game starts with New game's profile's values; this game only keeps what changes here.
	 */
	let { port }: { port: SetupGamePort } = $props();

	const gameId = $derived(port.game?.gameId ?? '');
	$effect(() => {
		if (gameId) gameSettings.seed(gameId, settingsProfiles.nextGamePreferences());
	});
	const before = $derived(gameId ? stepBeforeGameSettings(gameId) : 'new');
	const nextHref = $derived(gameId ? afterGameSettings(gameId) : undefined);
	const toDeal = $derived(nextHref?.endsWith('/deal') ?? false);
	async function goNext() {
		await goto(afterGameSettings(gameId));
	}
</script>

<Page title={t('setup.gameSettings')}>
	{#if gameId}
		<div class="rows" data-testid="game-settings"><GameSettingsRows {gameId} /></div>
		<SetupNav
			backHref={before === 'extras' ? resolve('/grimoire/[gameId]/extras', { gameId }) : undefined}
			onBack={before === 'new' ? () => void backToNewGame(gameId) : undefined}
			backLabel={before === 'extras' ? t('modes.extras.title') : t('setup.newGame')}
		>
			{#snippet next()}
				<Button
					variant="accent"
					icon="forward"
					data-testid="game-settings-next"
					onclick={() => void goNext()}
				>
					{toDeal ? dealTitle(gameId) : t('modes.extras.next')}
				</Button>
			{/snippet}
		</SetupNav>
	{/if}
</Page>

<style>
	.rows {
		display: grid;
	}
</style>

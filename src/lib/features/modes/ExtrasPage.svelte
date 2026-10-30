<script lang="ts">
	import { resolve } from '$app/paths';
	import { setupComplete } from '#lib/core/rules/index.ts';
	import type { SetupGamePort } from '#lib/features/setup/game-port.ts';
	import SetupNav from '#lib/features/setup/SetupNav.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import OffScriptExtras from './OffScriptExtras.svelte';
	import RuleHeader from './RuleHeader.svelte';
	import { spawnedBy } from './spawned-by.ts';
	import { setupHref } from './start.ts';

	/**
	 * A rule's hidden characters on a screen of their own, from the board's corner menu. The
	 * start flow picks them on Character selection (Trevor, 2026-10-29), so the bar goes back
	 * there until the game is set up, then to the board.
	 */
	let { port }: { port: SetupGamePort } = $props();

	const game = $derived(port.game!);
	const gameId = $derived(game.gameId);
	const started = $derived(setupComplete(game));
	/** The mode or rules that hide characters, shown at the top. */
	const spawning = $derived(spawnedBy(gameId, (p) => p.pool?.kind === 'script-plus-hidden'));
</script>

<Page title={t('modes.extras.title')}>
	<RuleHeader rules={spawning} />
	<OffScriptExtras {port} />
	{#if started}
		<SetupNav backHref={resolve('/grimoire/[gameId]', { gameId })} backLabel={t('setup.grimoire')}>
			{#snippet next()}{/snippet}
		</SetupNav>
	{:else}
		<SetupNav backHref={setupHref(gameId)} backLabel={t('setup.characters')}>
			{#snippet next()}{/snippet}
		</SetupNav>
	{/if}
</Page>

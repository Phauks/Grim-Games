<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import GameSettingsPage from '#lib/features/game-settings/GameSettingsPage.svelte';
	import WithGame from '#lib/features/setup/WithGame.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('setup.pageTitle.gameSettings')}</title>
</svelte:head>

{#key params.gameId}
	<WithGame gameId={params.gameId} title={t('setup.gameSettings')}>
		{#snippet children(port)}<GameSettingsPage {port} />{/snippet}
	</WithGame>
{/key}

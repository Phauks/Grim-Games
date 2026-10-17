<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SetupPage from '#lib/features/setup/SetupPage.svelte';
	import WithGame from '#lib/features/setup/WithGame.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('setup.pageTitle.characters')}</title>
</svelte:head>

{#key params.gameId}
	<WithGame gameId={params.gameId} title={t('setup.characters')}>
		{#snippet children(port)}<SetupPage {port} />{/snippet}
	</WithGame>
{/key}

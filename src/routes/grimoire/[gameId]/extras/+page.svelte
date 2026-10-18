<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ExtrasPage from '#lib/features/modes/ExtrasPage.svelte';
	import WithGame from '#lib/features/setup/WithGame.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('modes.extras.pageTitle')}</title>
</svelte:head>

{#key params.gameId}
	<WithGame gameId={params.gameId} title={t('modes.extras.title')}>
		{#snippet children(port)}<ExtrasPage {port} />{/snippet}
	</WithGame>
{/key}

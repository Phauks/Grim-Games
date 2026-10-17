<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ModeDealPage from '#lib/features/modes/ModeDealPage.svelte';
	import WithGame from '#lib/features/setup/WithGame.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('modes.deal.pageTitle')}</title>
</svelte:head>

{#key params.gameId}
	<WithGame gameId={params.gameId}>
		{#snippet children(port)}<ModeDealPage {port} />{/snippet}
	</WithGame>
{/key}

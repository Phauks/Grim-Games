<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import DrawPage from '#lib/features/setup/DrawPage.svelte';
	import WithGame from '#lib/features/setup/WithGame.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('setup.pageTitle.draw')}</title>
</svelte:head>

{#key params.gameId}
	<WithGame gameId={params.gameId} title={t('setup.draw')}>
		{#snippet children(port)}<DrawPage {port} />{/snippet}
	</WithGame>
{/key}

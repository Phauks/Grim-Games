<script lang="ts">
	import SpectersPage from '#lib/features/modes/SpectersPage.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('modes.specters.pageTitle')}</title>
</svelte:head>

{#key params.gameId}
	<SpectersPage gameId={params.gameId} />
{/key}

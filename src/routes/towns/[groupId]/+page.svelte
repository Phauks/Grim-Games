<script lang="ts">
	import TownsPage from '#lib/features/modes/TownsPage.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('modes.towns.pageTitle')}</title>
</svelte:head>

{#key params.groupId}
	<TownsPage groupId={params.groupId} />
{/key}

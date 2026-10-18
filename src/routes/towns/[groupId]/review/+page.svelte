<script lang="ts">
	import TownReviewPage from '#lib/features/modes/TownReviewPage.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('modes.towns.reviewPageTitle')}</title>
</svelte:head>

{#key params.groupId}
	<TownReviewPage groupId={params.groupId} />
{/key}

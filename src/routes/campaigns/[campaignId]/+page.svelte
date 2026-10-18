<script lang="ts">
	import CampaignPage from '#lib/features/modes/CampaignPage.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('modes.campaign.pageTitle')}</title>
</svelte:head>

{#key params.campaignId}
	<CampaignPage campaignId={params.campaignId} />
{/key}

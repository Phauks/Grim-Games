<script lang="ts">
	import PairedDrawPage from '#lib/features/modes/PairedDrawPage.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('modes.towns.drawPageTitle')}</title>
</svelte:head>

{#key params.groupId}
	<PairedDrawPage groupId={params.groupId} />
{/key}

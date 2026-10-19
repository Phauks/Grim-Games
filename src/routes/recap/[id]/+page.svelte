<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import RecapPage from '#lib/features/history/RecapPage.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{`${t('history.recapTitle')} · ${APP_NAME}`}</title>
</svelte:head>

{#key params.id}
	<RecapPage id={params.id} />
{/key}

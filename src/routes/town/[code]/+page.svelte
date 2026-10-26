<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import TownPage from '#lib/features/room/TownPage.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{`${t('room.town.title')} · ${APP_NAME}`}</title>
</svelte:head>

{#key params.code}
	<TownPage code={params.code} />
{/key}

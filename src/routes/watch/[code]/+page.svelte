<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import WatchPage from '#lib/features/room/WatchPage.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{`${t('room.watch.title')} · ${APP_NAME}`}</title>
</svelte:head>

{#key params.code}
	<WatchPage code={params.code} />
{/key}

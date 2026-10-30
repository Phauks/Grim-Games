<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import RoomPage from '#lib/features/room/RoomPage.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{`${t('room.players.title')} · ${APP_NAME}`}</title>
</svelte:head>

{#key params.gameId}
	<RoomPage gameId={params.gameId} players />
{/key}

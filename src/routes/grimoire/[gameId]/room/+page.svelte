<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import RoomPage from '#lib/features/room/RoomPage.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{`${t('room.title')} · Grim-Games`}</title>
</svelte:head>

{#key params.gameId}
	<RoomPage gameId={params.gameId} />
{/key}

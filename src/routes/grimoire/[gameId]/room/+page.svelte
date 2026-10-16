<script lang="ts">
	import RoomPage from '#lib/features/room/RoomPage.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>Players' phones · Grim-Games</title>
</svelte:head>

{#key params.gameId}
	<RoomPage gameId={params.gameId} />
{/key}

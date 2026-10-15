<script lang="ts">
	import GrimoirePage from '#lib/features/grimoire/GrimoirePage.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>Grimoire · Grim-Games</title>
</svelte:head>

{#key params.gameId}
	<GrimoirePage gameId={params.gameId} />
{/key}

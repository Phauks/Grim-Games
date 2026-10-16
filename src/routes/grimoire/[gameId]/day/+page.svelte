<script lang="ts">
	import DayPage from '#lib/features/day/DayPage.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>Day · Grim-Games</title>
</svelte:head>

{#key params.gameId}
	<DayPage gameId={params.gameId} />
{/key}

<script lang="ts">
	import DrawPage from '#lib/features/setup/DrawPage.svelte';
	import WithGame from '#lib/features/setup/WithGame.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>Draw · Grim-Games</title>
</svelte:head>

{#key params.gameId}
	<WithGame gameId={params.gameId}>
		{#snippet children(port)}<DrawPage {port} />{/snippet}
	</WithGame>
{/key}

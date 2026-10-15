<script lang="ts">
	import SetupPage from '#lib/features/setup/SetupPage.svelte';
	import WithGame from '#lib/features/setup/WithGame.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>Characters · Grim-Games</title>
</svelte:head>

{#key params.gameId}
	<WithGame gameId={params.gameId}>
		{#snippet children(port)}<SetupPage {port} />{/snippet}
	</WithGame>
{/key}

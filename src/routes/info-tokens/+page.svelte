<script lang="ts">
	import { onMount } from 'svelte';
	import { isSeatable } from '#lib/core/data/index.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import InfoTokensPanel from '#lib/features/info-tokens/InfoTokensPanel.svelte';

	onMount(() => void loadOfficialData());
	// Until a game's script is open, any character can be shown with a card.
	const characters = $derived(
		officialData.current?.characters.filter((c) => isSeatable(c.type)) ?? []
	);
</script>

<svelte:head>
	<title>Info tokens · Grim-Games</title>
</svelte:head>

<main>
	<h1>Info tokens</h1>
	<InfoTokensPanel {characters} />
</main>

<style>
	main {
		max-width: calc(48 * var(--u));
		margin: 0 auto;
		padding: var(--space-4);
	}
	h1 {
		margin-top: 0;
		font-family: var(--font-heading);
	}
</style>

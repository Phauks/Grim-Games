<script lang="ts">
	import { onMount } from 'svelte';
	import { editionScript } from '#lib/core/data/index.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import InfoTokensSheet from '#lib/features/info-tokens/InfoTokensSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';

	onMount(() => void loadOfficialData());
	const characters = $derived.by(() => {
		const data = officialData.current;
		return data ? (editionScript('tb', data)?.characters ?? []) : [];
	});
	// Sample seats as the grimoire board passes them: a name, or "Seat N" without one.
	const players = [
		{ id: 's1', label: 'Alex' },
		{ id: 's2', label: 'Sam' },
		{ id: 's3', label: 'Seat 3' },
		{ id: 's4', label: 'Jo' }
	];
	let open = $state(false);
</script>

<svelte:head>
	<title>Info tokens spike · Grim-Games</title>
</svelte:head>

<main>
	<h1>Info tokens sheet (preview)</h1>
	<Button icon="info" disabled={characters.length === 0} onclick={() => (open = true)}
		>Info tokens</Button
	>
	<InfoTokensSheet bind:open {characters} {players} />
</main>

<style>
	main {
		max-width: calc(40 * var(--u));
		margin: 0 auto;
		padding: var(--space-4);
	}
	h1 {
		font-family: var(--font-heading);
	}
</style>

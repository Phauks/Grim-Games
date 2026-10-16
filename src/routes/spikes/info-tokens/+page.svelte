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
	// Sample bluff sets as the grimoire board passes them (`showableBluffSets`).
	const twoSets = [
		{ set: 0, label: 'Demon', characterIds: ['chef', 'monk', 'mayor'] },
		{ set: 1, label: 'Set 2', characterIds: ['empath', 'slayer'] }
	];
	let open = $state(false);
	let openTwo = $state(false);
	let bluffPicker = $state(false);
</script>

<svelte:head>
	<title>Info tokens spike · Grim-Games</title>
</svelte:head>

<main>
	<h1>Info tokens sheet (preview)</h1>
	<div class="demos">
		<Button icon="info" disabled={characters.length === 0} onclick={() => (open = true)}
			>Info tokens</Button
		>
		<Button icon="info" disabled={characters.length === 0} onclick={() => (openTwo = true)}
			>Info tokens (two bluff sets)</Button
		>
	</div>
	<p data-testid="bluff-picker">{bluffPicker ? 'Bluff picker opened' : 'None'}</p>
	<InfoTokensSheet
		bind:open
		{characters}
		bluffSets={[]}
		onChooseBluffs={() => (bluffPicker = true)}
	/>
	<InfoTokensSheet bind:open={openTwo} {characters} bluffSets={twoSets} />
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
	.demos {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>

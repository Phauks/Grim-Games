<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { GameData, NumericNightOrder } from '#lib/core/data/index.ts';
	import { characterReference } from '#lib/core/rules/reference.ts';
	import {
		loadNumericNightOrder,
		loadOfficialData
	} from '#lib/features/characters/game-data.svelte.ts';
	import Tabs from '#lib/ui/primitives/Tabs.svelte';
	import CharacterReference from './CharacterReference.svelte';
	import NightOrderReference from './NightOrderReference.svelte';

	type View = 'characters' | 'night';

	let data = $state<GameData>();
	let numeric = $state<NumericNightOrder>();
	let error = $state<string>();
	let view = $state<View>('characters');

	// Built at runtime from the same data and rules code the app uses.
	const entries = $derived(data ? characterReference(data, numeric) : []);

	onMount(async () => {
		try {
			// The numeric snapshot is optional: without it the page still shows TPI's order.
			const [game, numbers] = await Promise.all([
				loadOfficialData(),
				loadNumericNightOrder().catch(() => undefined)
			]);
			numeric = numbers;
			data = game;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			return;
		}
		// A link to one character (#witch, from a bug report) scrolls to its card.
		const id = decodeURIComponent(location.hash.slice(1));
		if (id) {
			await tick();
			document.getElementById(id)?.scrollIntoView();
		}
	});
</script>

<main>
	<h1>Character reference</h1>
	<p class="intro">
		Everything the app uses for each official character, built from TPI’s data and our rules code as
		you open this page. Nothing here can be edited: if something looks wrong, use <em
			>Report a problem</em
		> on that character.
	</p>

	<Tabs
		bind:value={view}
		label="Reference views"
		tabs={[
			{ value: 'characters', label: 'Characters' },
			{ value: 'night', label: 'Night order' }
		]}
	>
		{#snippet panel(tab)}
			{#if error}
				<p role="alert">Could not load the character data: {error}</p>
			{:else if !data}
				<!-- Reserved space while the data loads, so nothing below jumps. -->
				<div class="loading" aria-busy="true">Loading characters…</div>
			{:else if tab === 'characters'}
				<CharacterReference {entries} />
			{:else}
				<NightOrderReference {data} {numeric} />
			{/if}
		{/snippet}
	</Tabs>
</main>

<style>
	main {
		max-width: 90rem;
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
	}
	h1 {
		margin-top: 0;
		font-size: 1.8rem;
	}
	.intro {
		max-width: 48rem;
		color: var(--on-surface-muted);
	}
	.loading {
		min-height: 100dvh;
		color: var(--on-surface-muted);
	}
</style>

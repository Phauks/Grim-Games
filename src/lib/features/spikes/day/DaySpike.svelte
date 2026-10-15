<script lang="ts">
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { onMount } from 'svelte';
	import type { Night } from '#lib/core/rules/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import { DayGame } from './day-game.svelte.ts';
	import DayPanel from './DayPanel.svelte';
	import NightPanel from './NightPanel.svelte';
	import type { Variant } from './sample-games.ts';

	// Spike (Phase 2 builds the real grimoire screen): a sample game through the real engine,
	// kept in memory only.
	let games = $state<Record<Variant, DayGame>>();
	let error = $state<string>();
	let variant = $state<Variant>('snv');
	let view = $state<'day' | 'night'>('day');
	let night = $state<Night>('other');

	const assistance = $derived(preferences.current.assistance);
	const game = $derived(games?.[variant]);

	onMount(async () => {
		try {
			const data = await loadOfficialData();
			games = {
				snv: new DayGame('snv', data),
				tb: new DayGame('tb', data),
				mixed: new DayGame('mixed', data)
			};
		} catch (e) {
			error = reportError(e, { area: 'day' })?.message ?? 'Unknown error';
		}
	});
</script>

<main>
	<h1>Day spike</h1>
	<p class="hint">
		A sample 8-player game. Log the day, then open the night order: answers come from the log.
	</p>
	<Segmented
		label="Sample game"
		value={variant}
		options={[
			{ value: 'snv', label: 'Sects & Violets' },
			{ value: 'tb', label: 'Trouble Brewing' },
			{ value: 'mixed', label: 'Assorted' }
		]}
		onChange={(value) => (variant = value)}
	/>

	{#if error}
		<p role="alert">Could not load the character data: {error}</p>
	{:else if !game}
		<!-- Reserved space while the data loads, so nothing below jumps. -->
		<div class="loading" aria-busy="true">Loading the sample game…</div>
	{:else if view === 'day'}
		{#key variant}
			<DayPanel {game} {assistance} onOpenNight={() => (view = 'night')} />
		{/key}
	{:else}
		{#key variant}
			<NightPanel
				{game}
				{assistance}
				{night}
				onNight={(value) => (night = value)}
				onBack={() => (view = 'day')}
			/>
		{/key}
	{/if}
</main>

<style>
	main {
		display: grid;
		gap: var(--space-4);
		max-width: calc(48 * var(--u));
		margin: 0 auto;
		padding: var(--space-4);
	}
	h1 {
		margin: 0;
		font-size: 1.4rem;
	}
	.hint {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.loading {
		min-height: 60dvh;
		color: var(--on-surface-muted);
	}
</style>

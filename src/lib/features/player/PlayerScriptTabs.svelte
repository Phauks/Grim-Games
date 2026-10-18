<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Snippet } from 'svelte';
	import type { LoadedScript, NumericNightOrder } from '#lib/core/data/index.ts';
	import {
		loadNumericNightOrder,
		loadOfficialData,
		officialData
	} from '#lib/features/characters/game-data.svelte.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import Tabs from '#lib/ui/primitives/Tabs.svelte';
	import PlayerNightOrder from './PlayerNightOrder.svelte';
	import { playerNight } from './player-script.ts';
	import ScriptCopy from './ScriptCopy.svelte';

	/**
	 * The players' Script and Night tabs as one component: /play shows it, and so does the
	 * board's Script button, so the Storyteller sees exactly what players see (Trevor,
	 * 2026-10-18). Notes are each player's own, so only /play adds that tab.
	 */
	interface Props {
		script: LoadedScript;
		/** Seats at the table; highlights that column of the Players breakdown. */
		players?: number;
		/** Characters on seats, in a game: Travellers and Jinxes start closed when none plays. */
		inPlay?: readonly string[];
		/** The player's own Notes tab (/play only). */
		notes?: Snippet;
		tab?: string;
	}

	let { script, players, inPlay, notes, tab = $bindable('script') }: Props = $props();

	let numeric = $state<NumericNightOrder>();
	$effect(() => {
		if (!officialData.current) void loadOfficialData();
		// Without the provisional numbers TPI's own order is used.
		loadNumericNightOrder().then(
			(n) => (numeric = n),
			() => undefined
		);
	});
	const data = $derived(officialData.current);
	const nights = $derived(
		data ? (['first', 'other'] as const).map((n) => playerNight(script, data, n, numeric)) : []
	);
	const tabs = $derived([
		{ value: 'script', label: t('player.tab.script') },
		{ value: 'night', label: t('player.tab.night') },
		...(notes ? [{ value: 'notes', label: t('player.tab.notes') }] : [])
	]);
</script>

<Tabs bind:value={tab} label={t('player.title')} {tabs}>
	{#snippet panel(value)}
		<div class="panel">
			<!-- A crash in one tab replaces only that tab. -->
			<ErrorBoundary area="play">
				{#if value === 'script'}
					<ScriptCopy {script} {players} {inPlay} byline={false} />
				{:else if value === 'night'}
					{#if data}<PlayerNightOrder {nights} />{:else}<p class="muted">
							{t('player.loading')}
						</p>{/if}
				{:else if notes}
					{@render notes()}
				{/if}
			</ErrorBoundary>
		</div>
	{/snippet}
</Tabs>

<style>
	.panel {
		padding-top: var(--space-3);
	}
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
</style>

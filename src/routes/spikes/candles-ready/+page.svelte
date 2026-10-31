<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import PlayersDayStatus from '#lib/features/day/PlayersDayStatus.svelte';
	import { seatCandles, type SeatPresence } from '#lib/core/sync/seat-presence.ts';
	import type { SeatId } from '#lib/core/model/index.ts';

	// MOCKUP ONLY: the setup candles with every seat lit, in each proposed effect.
	const ids = Array.from({ length: 8 }, (_, i) => `s${i + 1}` as SeatId);
	const seats = ids.map((seatId) => ({ seatId }));
	const allHere: SeatPresence = { here: ids, away: [], unseated: 0 };
	const oneAway: SeatPresence = { here: ids.slice(1), away: [ids[0]], unseated: 1 };
	const options = [
		{ key: undefined, label: 'Today: one phone still away' },
		{ key: undefined, label: 'Today: all lit, no effect', all: true },
		{ key: 'glow', label: 'A · Warm glow' },
		{ key: 'horizon', label: 'B · Gold horizon' },
		{ key: 'sparks', label: 'C · Rising sparks' },
		{ key: 'wave', label: 'D · Flare, then in step' }
	] as const;
	const only = $derived(page.url.searchParams.get('only'));
	// ?demo: the last phone connects after a moment, to show the effect start.
	let litNow = $state(!page.url.searchParams.has('demo'));
	onMount(() => {
		const timer = setTimeout(() => (litNow = true), 1500);
		return () => clearTimeout(timer);
	});
</script>

<main>
	{#each options as o, i (i)}
		{#if !only || only === (o.key ?? `base${i}`)}
			<section>
				<h2>{o.label}</h2>
				<p class="who">Player's phone</p>
				<PlayersDayStatus
					phase={{ kind: 'setup' }}
					wide
					setupLook="candles"
					candles={seatCandles(
						seats,
						(o.key && litNow) || ('all' in o && o.all) ? allHere : oneAway,
						ids[1]
					)}
					ready={o.key}
				/>
				<p class="who">Storyteller, character selection</p>
				<PlayersDayStatus
					phase={{ kind: 'setup' }}
					wide
					setupLook="candles"
					candles={seatCandles(
						seats,
						(o.key && litNow) || ('all' in o && o.all) ? allHere : oneAway
					)}
					ready={o.key}
				/>
			</section>
		{/if}
	{/each}
</main>

<style>
	main {
		padding: calc(var(--u) * 2);
		display: grid;
		gap: calc(var(--u) * 3);
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.who {
		margin: calc(var(--u) * 1) 0 calc(var(--u) * 0.5);
		font-size: 0.8rem;
		color: var(--on-surface-muted);
	}
</style>

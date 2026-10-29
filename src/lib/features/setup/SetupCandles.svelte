<script lang="ts">
	import { seatsInOrder, type Game } from '#lib/core/model/index.ts';
	import { seatCandles, seatConnections } from '#lib/core/sync/seat-presence.ts';
	import PlayersDayStatus from '#lib/features/day/PlayersDayStatus.svelte';
	import { roomHost } from '#lib/features/room/host.svelte.ts';

	/**
	 * The candles players' phones show beside Setup, in character selection's setup area, so the
	 * Storyteller sees who has connected while choosing characters (Trevor, 2026-10-29). Always
	 * the candles, whatever look phones are shown, and a tap lists who is connected. With no room
	 * open nobody is, so every candle is a stub.
	 */
	let { game }: { game: Game | undefined } = $props();

	const host = roomHost();
	const seats = $derived(game ? seatsInOrder(game) : []);
	const presence = $derived(host.code ? host.seatPresence : { here: [], away: [], unseated: 0 });
	// The phones the +1 counts, asleep too, as Share lists them (Trevor, 2026-10-29).
	const unseatedNames = $derived(
		host.code ? host.unseatedInGame.flatMap((m) => (m.name ? [m.name] : [])) : []
	);
</script>

<div class="setup-candles" data-testid="setup-candles">
	<PlayersDayStatus
		phase={{ kind: 'setup' }}
		wide
		setupLook="candles"
		candles={seatCandles(seats, presence)}
		unseated={presence.unseated}
		connections={seatConnections(seats, presence)}
		{unseatedNames}
	/>
</div>

<style>
	.setup-candles {
		display: flex;
	}
	.setup-candles > :global([data-testid='players-status']) {
		flex: 1;
	}
</style>

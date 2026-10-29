<script lang="ts">
	import type { Game, SeatId } from '#lib/core/model/index.ts';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import PlayerProfileDialog from '#lib/features/player/PlayerProfileDialog.svelte';
	import { roomHost } from '#lib/features/room/host.svelte.ts';

	/** A seated player's profile on the board, from their avatar mark (Trevor, 2026-10-28). */
	let {
		open = $bindable(false),
		game,
		seatId
	}: { open?: boolean; game: Game; seatId: SeatId | undefined } = $props();

	const seat = $derived(seatId ? game.seats[seatId] : undefined);
</script>

{#if seat?.avatar && seatId}<PlayerProfileDialog
		bind:open
		name={seatName(game, seatId)}
		avatar={seat.avatar}
		picture={roomHost().pictureOf(seatId)}
		frame={seat.frame}
	/>{/if}

<script lang="ts">
	import type { Game, SeatId } from '#lib/core/model/index.ts';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import PlayerProfileDialog from '#lib/features/player/PlayerProfileDialog.svelte';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { wordsOf } from '#lib/core/sync/room-look.ts';

	/** A seated player's profile on the board, from their avatar mark (Trevor, 2026-10-28). */
	let {
		open = $bindable(false),
		game,
		seatId
	}: { open?: boolean; game: Game; seatId: SeatId | undefined } = $props();

	const seat = $derived(seatId ? game.seats[seatId] : undefined);
	const code = $derived(roomHost().code);
	// The player's tag-line and details, as their phone shared them (2026-11-01).
	const words = $derived.by(() => {
		const member = roomHost().members.find((m) => m.seatId === seatId);
		return member ? wordsOf(member) : undefined;
	});
</script>

{#if seat?.avatar && seatId}<PlayerProfileDialog
		bind:open
		name={seatName(game, seatId)}
		avatar={seat.avatar}
		picture={roomHost().pictureOf(seatId)}
		frame={seat.frame}
		{words}
		friend={code ? { code, seatId } : undefined}
	/>{/if}

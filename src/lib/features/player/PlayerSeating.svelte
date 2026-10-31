<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import type { PublicSeat } from '#lib/core/sync/public-projection.ts';
	import { dropOnto, isOpenSeat } from '#lib/core/sync/room-seating-open.ts';
	import { seatFrame } from '#lib/core/frames/index.ts';
	import type { RoomPlayer } from '#lib/features/room/player.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import SeatDisc from '#lib/ui/seating/SeatDisc.svelte';
	import { sharedPlace, type SeatPoint } from '#lib/ui/seating/seat-layout.ts';

	/**
	 * Seating on the Grim tab (plan J38; Trevor, 2026-10-29 22:36). While the Storyteller has
	 * seating open, the player drags their own disc, and only theirs, onto the seat they want: that
	 * seat lights up and the line in the middle names it, and the drop takes its place (Trevor,
	 * 2026-10-31: not a gap between seats). Dropped in a space, their seat moves there, to match
	 * where they really sit (Trevor, 2026-10-31); back on its own spot, nothing changes. A phone
	 * with no seat yet starts with its disc in the middle. Once seating is locked, a phone with
	 * no seat taps an open seat (`claim`) to sit there. The Storyteller's board makes the change.
	 */
	interface Props {
		player: RoomPlayer;
		ring: { seats: readonly PublicSeat[]; points: readonly SeatPoint[]; size: number };
		board: { width: number; height: number };
		town: HTMLElement | undefined;
		nameOf: (seat: PublicSeat) => string;
		/** The Storyteller's board's shape, and whether this grim draws in it (sharedSeats). */
		shape: { aspect: number | undefined; fit: boolean };
		/** A tap on the player's own disc, which opens their seat as before. */
		onTap: (seat: PublicSeat) => void;
	}

	let { player, ring, board, town, nameOf, shape, onTap }: Props = $props();

	const me = $derived(player.view?.me);
	const open = $derived(!!player.view?.seatingOpen && !!me?.name);
	const index = $derived(ring.seats.findIndex((s) => s.seatId === me?.seatId));
	const own = $derived(index >= 0 ? ring.seats[index] : undefined);
	/** Where the disc sits when not held: its seat, or the middle for a phone with no seat. */
	const home = $derived(own ? ring.points[index] : { x: 50, y: 38 });

	/** Pointer movement, in pixels, before a press counts as a drag (as on the board). */
	const DRAG_SLOP = 6;
	let drag = $state<{ pointerId: number; from: { x: number; y: number }; at: SeatPoint }>();
	let moved = $state(false);
	const px = (p: SeatPoint) => ({ x: (p.x / 100) * board.width, y: (p.y / 100) * board.height });
	/** The seat the disc would take if dropped now, and where it is drawn. */
	const target = $derived.by(() => {
		if (!drag || !moved) return undefined;
		const others = ring.seats.flatMap((s, i) => (i === index ? [] : [{ s, p: ring.points[i] }]));
		const id = dropOnto(
			others.map((o) => o.s.seatId),
			others.map((o) => px(o.p)),
			px(drag.at),
			ring.size
		);
		return others.find((o) => o.s.seatId === id);
	});
	/**
	 * Where the disc would move the seat if dropped now: on the board, clear of every seat and
	 * of its own spot (a seat's width away, or two from the middle for a phone with no seat).
	 */
	const place = $derived.by(() => {
		if (!drag || !moved || target) return undefined;
		const at = drag.at;
		if (at.x < 0 || at.x > 100 || at.y < 0 || at.y > 100) return undefined;
		const from = px(home);
		const to = px(at);
		const clear = (own ? 0.5 : 1) * ring.size;
		return Math.hypot(to.x - from.x, to.y - from.y) > clear ? at : undefined;
	});

	function point(event: PointerEvent): SeatPoint | undefined {
		const rect = town?.getBoundingClientRect();
		if (!rect?.width || !rect.height) return undefined;
		return {
			x: ((event.clientX - rect.left) / rect.width) * 100,
			y: ((event.clientY - rect.top) / rect.height) * 100
		};
	}

	function down(event: PointerEvent) {
		if (drag) return;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		drag = { pointerId: event.pointerId, from: { x: event.clientX, y: event.clientY }, at: home };
	}

	function move(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.pointerId) return;
		const far = Math.hypot(event.clientX - drag.from.x, event.clientY - drag.from.y);
		if (!moved && far < DRAG_SLOP) return;
		moved = true;
		const at = point(event);
		if (at) drag = { ...drag, at };
	}

	function up(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.pointerId) return;
		const onto = target?.s;
		const spot = place;
		const tapped = !moved;
		cancel();
		if (onto) player.askSeat({ type: 'sit', onto: onto.seatId });
		else if (spot)
			player.askSeat({ type: 'sit', place: sharedPlace(spot, board, shape.aspect, shape.fit) });
		else if (tapped && own) onTap(own);
	}

	function cancel() {
		drag = undefined;
		moved = false;
	}

	/** After the lock: the open seat this phone asked to sit in, waiting for Confirm. */
	let claiming = $state<PublicSeat>();
	let confirming = $state(false);
	/** Takes a tap on a seat when it claims that seat; false lets the grim open it as usual. */
	export function claim(seat: PublicSeat): boolean {
		if (player.view?.seatingOpen || !me?.name || me.seatId || !isOpenSeat(seat)) return false;
		claiming = seat;
		confirming = true;
		return true;
	}
	const neighbours = $derived.by(() => {
		const i = ring.seats.findIndex((s) => s.seatId === claiming?.seatId);
		const n = ring.seats.length;
		if (i < 0 || n < 2) return [];
		const [a, b] = [ring.seats[(i - 1 + n) % n], ring.seats[(i + 1) % n]];
		return a === b ? [a] : [a, b];
	});
	const badge = (seat: PublicSeat) => nameOf(seat) as PlayerName;
</script>

{#if open && me}
	{@const at = drag && moved ? drag.at : home}
	{#if target}<span
			class="target"
			style:left="{target.p.x}%"
			style:top="{target.p.y}%"
			style:--disc={`${ring.size}px`}
			data-testid="seating-target"
			data-seat={target.s.seatNumber}
		></span>{/if}
	<button
		type="button"
		class="disc"
		class:held={!!drag}
		class:unseated={!own}
		style:left="{at.x}%"
		style:top="{at.y}%"
		style:--disc={`${ring.size}px`}
		aria-label={t('player.seating.drag')}
		data-testid="seating-disc"
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={cancel}
	>
		{#if !own || (drag && moved)}<SeatDisc
				size={ring.size}
				name={me.name!}
				number={own?.seatNumber ?? 0}
				avatar={me.avatar ?? 'initials'}
				frame={seatFrame(me.frame)}
			/>{/if}
	</button>
	<!-- The status line, over the middle of the town, so nothing on the screen moves. -->
	<p class="line" role="status" data-testid="seating-line">
		{#if target}{t('player.seating.take', { number: target.s.seatNumber })}
			{#if !isOpenSeat(target.s)}<PlayerBadge name={badge(target.s)} />{/if}
		{:else if place}{t('player.seating.move')}
		{:else}{t('player.seating.open')}{/if}
	</p>
{/if}

<ConfirmDialog
	bind:open={confirming}
	title={t('player.seating.claim', { number: claiming?.seatNumber ?? 0 })}
	onConfirm={() => claiming && player.askSeat({ type: 'claim-seat', seatId: claiming.seatId })}
>
	{#if neighbours.length}<p data-testid="seating-claim">
			{t('player.seating.between')}
			<PlayerBadge name={badge(neighbours[0])} />{#if neighbours[1]}
				{t('player.seating.and')} <PlayerBadge name={badge(neighbours[1])} />{/if}
		</p>{/if}
</ConfirmDialog>

<style>
	/* Over the player's own seat (or the middle), the size of a seat, taking the drag. */
	.disc {
		position: absolute;
		z-index: 3;
		width: var(--disc);
		height: var(--disc);
		padding: 0;
		border: none;
		border-radius: 50%;
		background: none;
		transform: translate(-50%, -50%);
		touch-action: none;
		cursor: grab;
	}
	.disc.held {
		z-index: 4;
		cursor: grabbing;
	}
	/* The seat the held disc would take: a ring round it, under the disc. */
	.target {
		position: absolute;
		z-index: 2;
		width: calc(var(--disc) * 1.2);
		height: calc(var(--disc) * 1.2);
		transform: translate(-50%, -50%);
		border-radius: 50%;
		box-shadow:
			0 0 0 0.25em var(--accent),
			0 0 0 0.5em var(--focus-glow);
		pointer-events: none;
	}
	.disc.unseated {
		opacity: 0.9;
	}
	.line {
		position: absolute;
		left: 50%;
		top: 50%;
		z-index: 2;
		max-width: 90%;
		margin: 0;
		padding: 0.25em 0.75em;
		transform: translate(-50%, -50%);
		border-radius: var(--radius-full);
		background: var(--board-bar-background);
		color: var(--on-surface);
		text-align: center;
		pointer-events: none;
	}
</style>

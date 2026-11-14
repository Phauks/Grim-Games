<script lang="ts">
	import type { SeatPoint } from '#lib/ui/seating/seat-layout.ts';
	import { rimToward, toPx, type BoardSize } from './board-geometry.ts';
	import { lineShown, type ReminderLines } from './reminder-lines.ts';

	/**
	 * A bold line from each seat to its reminders (Trevor, 2026-10-22: reminders keep to their
	 * seat's line, with a line back when they have to sit further out), so whose a reminder is
	 * reads at a glance. The Storyteller's board and a player's Grim tab both draw them (Trevor,
	 * 2026-10-29), each with its own "Reminder lines" choice. Goes first in the town, so every
	 * token, name, ghost vote and mark draws over them (Trevor, 2026-10-24).
	 */
	interface Props {
		/** Each seat's centre and its reminders' centres, in % of the board, in seating order. */
		seats: readonly { at: SeatPoint; spots: readonly SeatPoint[]; held?: boolean }[];
		board: BoardSize;
		/** Token and reminder diameters in px. */
		size: number;
		chip: number;
		mode: ReminderLines;
		/**
		 * Drawn after the seats (the Grim tab, PlayerSeatReminders): sent under them, just over
		 * the backdrop, which the town keeps under everything.
		 */
		under?: boolean;
	}

	let { seats, board, size, chip, mode, under = false }: Props = $props();

	const shows = (seat: SeatPoint, at: SeatPoint, held: boolean) =>
		lineShown(mode, { seat: toPx(seat, board), at: toPx(at, board), size, chip, held });
</script>

<svg
	class="tethers"
	class:under
	viewBox="0 0 100 100"
	preserveAspectRatio="none"
	aria-hidden="true"
>
	{#each seats as seat, i (i)}
		{#each seat.spots as p, k (k)}
			{#if shows(seat.at, p, !!seat.held)}
				{@const from = rimToward(seat.at, p, board, size)}
				<line
					class="edge"
					x1={from.x}
					y1={from.y}
					x2={p.x}
					y2={p.y}
					vector-effect="non-scaling-stroke"
				/>
				<line
					class:held={seat.held}
					x1={from.x}
					y1={from.y}
					x2={p.x}
					y2={p.y}
					data-tether={i + 1}
					vector-effect="non-scaling-stroke"
				/>
			{/if}
		{/each}
	{/each}
</svg>

<style>
	.tethers {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}
	.under {
		z-index: var(--z-under);
	}
	/* Bold, with a dark edge so it shows on every background (Trevor, 2026-11-13: the thin
	   line was weak and hard to see). */
	line {
		stroke: var(--on-surface);
		stroke-opacity: 0.9;
		stroke-width: 3;
		stroke-linecap: round;
	}
	line.edge {
		stroke: var(--surface);
		stroke-width: 6;
	}
</style>

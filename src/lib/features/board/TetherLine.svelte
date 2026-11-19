<script lang="ts">
	import type { SeatPoint } from '#lib/ui/seating/seat-layout.ts';

	/**
	 * One seat-to-reminder line, as every board draws it: bold, with an edge so it shows on every
	 * background (Trevor, 2026-11-13: the thin line was weak and hard to see). The edge is the
	 * character token's rim colour (Theme > Character tokens), as TokenFace draws it, not black (Trevor,
	 * 2026-11-18). Goes inside an `<svg>`: ReminderTethers on the boards, and the Settings Board
	 * preview's sample.
	 */
	interface Props {
		from: SeatPoint;
		to: SeatPoint;
		/** The seat's number, on the line itself (not its edge), for tests. */
		seat?: number;
		held?: boolean;
	}

	let { from, to, seat, held = false }: Props = $props();
</script>

<line class="edge" x1={from.x} y1={from.y} x2={to.x} y2={to.y} vector-effect="non-scaling-stroke" />
<line
	class="line"
	class:held
	x1={from.x}
	y1={from.y}
	x2={to.x}
	y2={to.y}
	data-tether={seat}
	vector-effect="non-scaling-stroke"
/>

<style>
	line {
		stroke: var(--on-surface);
		stroke-opacity: 0.9;
		stroke-width: 3;
		stroke-linecap: round;
	}
	.edge {
		stroke: var(--token-face-shade, var(--border));
		stroke-width: 6;
	}
</style>

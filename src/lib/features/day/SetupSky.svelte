<script lang="ts">
	import type { SetupLook } from '#lib/core/rules/index.ts';
	import type { Candle } from '#lib/core/sync/seat-presence.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';

	/**
	 * What players' phones show beside Setup, in the sun's space on the status row, as the
	 * Storyteller chooses (Trevor, 2026-10-28). Candles: one per seat, lit while that player's
	 * phone is connected, an ember on the wick while it is away, a faded stub while nobody sits
	 * there; this phone's own flame burns red, the heights are random but never close to a
	 * neighbour's, and phones with no seat are a count on the right. Town at dusk: rooftops
	 * and a clock tower with windows lighting. Dusk: the glow on the horizon after sunset and
	 * the evening's first star. Each stands on the horizon the day and night draw.
	 */
	interface Props {
		look: SetupLook;
		/** One per seat, in seat order (`seatCandles`); only for the candles. */
		candles?: readonly Candle[];
		/** Phones in the room with no seat (`SeatPresence.unseated`). */
		unseated?: number;
	}

	let { look, candles = [], unseated = 0 }: Props = $props();
	const id = $props.id();

	/** The drawing's units, as the day's sky (PlayersDayStatus). */
	const SKY_W = 270;
	const SKY_H = 60;
	const GROUND = SKY_H - 10;

	/**
	 * Room on the right for the count of phones with no seat, kept when there are none, so the
	 * candles never move as a phone comes or goes (no reflow, Trevor).
	 */
	const reserve = 24;
	const placed = $derived.by(() => {
		const n = candles.length;
		const x0 = 22;
		const x1 = SKY_W - 22 - reserve;
		const step = n > 1 ? (x1 - x0) / (n - 1) : 0;
		const width = Math.min(8, Math.max(4.5, step * 0.45));
		return candles.map((candle, i) => {
			const height = 13 + candle.height * 16;
			return {
				...candle,
				x: n > 1 ? x0 + step * i : (x0 + x1) / 2,
				width,
				top: GROUND - height,
				height,
				flame: Math.min(11, width * 1.6)
			};
		});
	});
	const lit = $derived(candles.filter((c) => c.state === 'lit').length);
	const candlesLabel = $derived(
		[
			t('day.candlesLabel', { lit, total: candles.length }),
			unseated > 0 ? t('day.unseatedLabel', { count: unseated }) : ''
		]
			.filter(Boolean)
			.join('. ')
	);

	/** A flame's outline, its foot on the wick at (x, y). */
	function flamePath(x: number, y: number, h: number): string {
		return `M${x} ${y - h} C ${x + h * 0.35} ${y - h * 0.5}, ${x + h * 0.28} ${y}, ${x} ${y} C ${x - h * 0.28} ${y}, ${x - h * 0.35} ${y - h * 0.5}, ${x} ${y - h} Z`;
	}

	/** Rooftops along the horizon, with a clock tower in the middle. */
	const ROOFS = `M10 ${GROUND} V40 L18 33 L26 40 V${GROUND} M30 ${GROUND} V42 H48 V${GROUND} M52 ${GROUND} V36 L62 28 L72 36 V${GROUND} M78 ${GROUND} V41 L86 35 L94 41 V${GROUND} M100 ${GROUND} V30 H108 V22 L114 14 L120 22 V30 H128 V${GROUND} M134 ${GROUND} V38 L144 31 L154 38 V${GROUND} M160 ${GROUND} V43 H178 V${GROUND} M184 ${GROUND} V35 L194 27 L204 35 V${GROUND} M210 ${GROUND} V41 L218 35 L226 41 V${GROUND} M232 ${GROUND} V38 H250 V${GROUND} M254 ${GROUND} V42 L260 37 L264 42 V${GROUND}`;
	const WINDOWS = [
		[62, 40],
		[114, 34],
		[120, 42],
		[144, 42],
		[194, 39],
		[240, 44],
		[18, 44]
	] as const;
	/** The evening's first star, a four-pointed glint. */
	const STAR = 'M88 14 l1.6 4.4 4.4 1.6 -4.4 1.6 -1.6 4.4 -1.6 -4.4 -4.4 -1.6 4.4 -1.6 z';
</script>

{#if look === 'candles'}
	<svg
		class="setup-sky"
		data-testid="players-setup-sky"
		data-look="candles"
		viewBox="0 0 {SKY_W} {SKY_H}"
		role="img"
		aria-label={candlesLabel}
	>
		{#each placed as c, i (i)}
			<g class="candle" data-state={c.state} data-mine={c.mine ? '' : undefined}>
				{#if c.state === 'lit'}
					<circle class="halo" cx={c.x} cy={c.top - c.flame / 2 - 2} r={c.flame * 0.85} />
				{/if}
				<rect
					class="wax"
					x={c.x - c.width / 2}
					y={c.top}
					width={c.width}
					height={c.height}
					rx="1.2"
				/>
				<line class="wick" x1={c.x} y1={c.top} x2={c.x} y2={c.top - 2.5} />
				{#if c.state === 'lit'}
					<path
						class="flame"
						style:animation-delay="{-i * 0.37}s"
						d={flamePath(c.x, c.top - 2.5, c.flame)}
					/>
				{:else if c.state === 'away'}
					<circle
						class="ember"
						style:animation-delay="{-i * 0.5}s"
						cx={c.x}
						cy={c.top - 2.8}
						r="1.6"
					/>
				{/if}
			</g>
		{/each}
		<line class="horizon" x1="6" y1={GROUND} x2={SKY_W - 6 - reserve} y2={GROUND} />
		{#if unseated > 0}
			<text class="unseated" x={SKY_W - 6} y={GROUND - 8} text-anchor="end" font-size="11"
				>+{unseated}</text
			>
		{/if}
	</svg>
{:else if look === 'town'}
	<svg
		class="setup-sky"
		data-testid="players-setup-sky"
		data-look="town"
		viewBox="0 0 {SKY_W} {SKY_H}"
		aria-hidden="true"
	>
		<path class="roofs" d={ROOFS} />
		<circle class="clock" cx="114" cy="24" r="3" />
		{#each WINDOWS as [x, y], i (i)}
			<rect
				class="window"
				style:animation-delay="{-i * 0.6}s"
				x={x - 1.5}
				y={y - 2}
				width="3"
				height="4"
			/>
		{/each}
		<line class="horizon" x1="6" y1={GROUND} x2={SKY_W - 6} y2={GROUND} />
	</svg>
{:else}
	<svg
		class="setup-sky"
		data-testid="players-setup-sky"
		data-look="dusk"
		viewBox="0 0 {SKY_W} {SKY_H}"
		aria-hidden="true"
	>
		<linearGradient id="{id}-dusk" x1="0" y1="0" x2="0" y2="1">
			<stop class="dusk-top" offset="0" />
			<stop class="dusk-mid" offset="0.6" />
			<stop class="dusk-low" offset="1" />
		</linearGradient>
		<!-- The glow fades out at either end rather than stopping at an edge. -->
		<linearGradient id="{id}-ends" x1="0" y1="0" x2="1" y2="0">
			<stop class="hidden" offset="0" />
			<stop class="shown" offset="0.12" />
			<stop class="shown" offset="0.88" />
			<stop class="hidden" offset="1" />
		</linearGradient>
		<mask id="{id}-fade"
			><rect x="0" y="0" width={SKY_W} height={GROUND} fill="url(#{id}-ends)" /></mask
		>
		<rect x="0" y="0" width={SKY_W} height={GROUND} fill="url(#{id}-dusk)" mask="url(#{id}-fade)" />
		<path class="star" d={STAR} />
		<line class="horizon" x1="6" y1={GROUND} x2={SKY_W - 6} y2={GROUND} />
	</svg>
{/if}

<style>
	.setup-sky {
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.horizon {
		stroke: var(--on-surface-muted);
		stroke-width: 2;
		stroke-linecap: round;
	}
	.wax {
		fill: var(--sky-moon);
		opacity: 0.85;
	}
	.candle[data-state='empty'] .wax {
		opacity: 0.3;
	}
	.wick {
		stroke: var(--on-surface-muted);
		stroke-width: 1;
	}
	.candle[data-state='empty'] .wick {
		opacity: 0.5;
	}
	.flame,
	.halo {
		fill: var(--sky-sun);
	}
	/* This phone's own seat (Trevor, 2026-10-28: "your seat should be red"). */
	.candle[data-mine] .flame,
	.candle[data-mine] .halo {
		fill: var(--sky-own-flame);
	}
	.halo {
		opacity: 0.15;
	}
	.ember {
		fill: var(--sky-afternoon);
	}
	.unseated {
		fill: var(--on-surface-muted);
		font-weight: 700;
	}
	.roofs {
		fill: var(--surface);
		stroke: var(--on-surface-muted);
		stroke-width: 0.8;
	}
	.clock {
		fill: none;
		stroke: var(--on-surface-muted);
		stroke-width: 0.8;
	}
	.window {
		fill: var(--sky-sun);
	}
	.dusk-top {
		stop-color: var(--sky-dusk);
		stop-opacity: 0;
	}
	.dusk-mid {
		stop-color: var(--sky-dusk);
		stop-opacity: 0.45;
	}
	.dusk-low {
		stop-color: var(--sky-afternoon);
		stop-opacity: 0.8;
	}
	.star {
		fill: var(--sky-moon);
	}
	/* Mask paint: white shows, black hides. */
	.shown {
		stop-color: white; /* colour-ok: a mask's paint, never seen */
	}
	.hidden {
		stop-color: black; /* colour-ok: a mask's paint, never seen */
	}
	/* Gentle motion: flames flicker, the embers and windows glow, the star twinkles. */
	.flame,
	.ember,
	.window,
	.star {
		transform-box: fill-box;
		transform-origin: center;
	}
	.flame {
		transform-origin: center bottom;
	}
	@media (prefers-reduced-motion: no-preference) {
		.flame {
			animation: flicker 3s ease-in-out infinite;
		}
		.ember,
		.window {
			animation: glow 4s ease-in-out infinite;
		}
		.star {
			animation: twinkle 4s ease-in-out infinite;
		}
	}
	@keyframes flicker {
		0%,
		100% {
			transform: scale(1, 1);
			opacity: 1;
		}
		40% {
			transform: scale(0.92, 1.08);
			opacity: 0.9;
		}
		70% {
			transform: scale(1.04, 0.95);
		}
	}
	@keyframes glow {
		0%,
		100% {
			opacity: 0.45;
		}
		50% {
			opacity: 1;
		}
	}
	@keyframes twinkle {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.55;
			transform: scale(0.8);
		}
	}
</style>

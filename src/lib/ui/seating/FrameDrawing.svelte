<script lang="ts">
	import { frameMaskSvg, type Frame } from '#lib/core/frames/index.ts';

	/**
	 * A frame's drawing (`core/frames`), filling the box it is placed in, and its motion
	 * (Trevor, 2026-10-28): a light sweeping across it or round it, inside its own outline; the
	 * whole drawing turning, pulsing, breathing, flickering or growing in again; or sparkles
	 * twinkling round it. All are CSS transforms, opacity or a short mask, so a full town of
	 * them stays smooth.
	 * Purely decorative: the seat's label says everything, so it is hidden from screen readers.
	 */
	let { frame }: { frame: Frame } = $props();

	/** Where Twinkle's sparkles sit round the ring: degrees from the top, and a delay. */
	const SPARKLES = [20, 95, 150, 215, 270, 330].map((degrees, i) => {
		const radians = (degrees * Math.PI) / 180;
		return {
			left: 50 + 46 * Math.sin(radians),
			top: 50 - 46 * Math.cos(radians),
			delay: (i * 0.37) % 1.8
		};
	});
	const shimmer = $derived(frame.motion?.startsWith('shimmer') ? frame.motion : undefined);
	const mask = $derived(
		shimmer ? `url("data:image/svg+xml,${encodeURIComponent(frameMaskSvg(frame))}")` : undefined
	);
</script>

<span class="frame-drawing" data-motion={frame.motion} aria-hidden="true">
	<svg class="frame" viewBox="0 0 100 100" data-frame={frame.id}>
		{#each frame.drawing as part, index (index)}
			{#if part.shape === 'circle'}
				<circle
					cx={part.cx}
					cy={part.cy}
					r={part.r}
					stroke-width={part.width}
					style:fill={part.fill ?? 'none'}
					style:stroke={part.stroke}
					style:opacity={part.opacity}
				/>
			{:else if part.shape === 'ellipse'}
				<ellipse
					cx={part.cx}
					cy={part.cy}
					rx={part.rx}
					ry={part.ry}
					transform="rotate({part.rotate} {part.cx} {part.cy})"
					stroke-width={part.width}
					style:fill={part.fill ?? 'none'}
					style:stroke={part.stroke}
					style:opacity={part.opacity}
				/>
			{:else}
				<path
					d={part.d}
					stroke-width={part.width}
					stroke-linecap="round"
					stroke-linejoin="round"
					style:fill={part.fill ?? 'none'}
					style:stroke={part.stroke}
					style:opacity={part.opacity}
				/>
			{/if}
		{/each}
	</svg>
	{#if frame.motion === 'twinkle'}{#each SPARKLES as sparkle, i (i)}<span
				class="sparkle"
				style:left="{sparkle.left}%"
				style:top="{sparkle.top}%"
				style:animation-delay="{sparkle.delay}s"
			></span>{/each}{/if}
	{#if mask}<span class="shine" data-shimmer={shimmer} style:mask-image={mask}><i></i></span>{/if}
</span>

<style>
	.frame-drawing {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.frame {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	/* Turns slowly round its centre, either way. */
	.frame-drawing:is([data-motion='rotate-cw'], [data-motion='rotate-ccw']) {
		animation: frame-turn 24s linear infinite;
	}
	.frame-drawing[data-motion='rotate-ccw'] {
		animation-direction: reverse;
	}
	/* A heartbeat: two quick swells, then rest. */
	.frame-drawing[data-motion='pulse'] {
		animation: frame-pulse 1.8s ease-in-out infinite;
	}
	@keyframes frame-pulse {
		0%,
		40%,
		100% {
			scale: 1;
		}
		15% {
			scale: 1.05;
		}
		28% {
			scale: 1.025;
		}
	}
	/* Slowly brightening and dimming. */
	.frame-drawing[data-motion='breathe'] {
		animation: frame-breathe 4s ease-in-out infinite alternate;
	}
	@keyframes frame-breathe {
		from {
			opacity: 0.55;
		}
		to {
			opacity: 1;
		}
	}
	/* An uneven glow, like a candle. */
	.frame-drawing[data-motion='flicker'] {
		animation: frame-flicker 2.6s linear infinite;
	}
	@keyframes frame-flicker {
		0%,
		100% {
			opacity: 1;
		}
		8% {
			opacity: 0.78;
		}
		12% {
			opacity: 0.95;
		}
		31% {
			opacity: 0.7;
		}
		36% {
			opacity: 1;
		}
		58% {
			opacity: 0.85;
		}
		63% {
			opacity: 0.66;
		}
		70% {
			opacity: 0.97;
		}
	}
	/* The unlock draw-in again every few seconds: two arcs up from the foot. */
	@property --regrow-sweep {
		syntax: '<angle>';
		inherits: false;
		initial-value: 180deg;
	}
	.frame-drawing[data-motion='regrow'] {
		mask-image: conic-gradient(
			from 180deg,
			currentColor 0deg var(--regrow-sweep),
			transparent var(--regrow-sweep) calc(360deg - var(--regrow-sweep)),
			currentColor calc(360deg - var(--regrow-sweep))
		);
		animation: frame-regrow 7s ease-out infinite;
	}
	@keyframes frame-regrow {
		0% {
			--regrow-sweep: 0deg;
		}
		18%,
		100% {
			--regrow-sweep: 180deg;
		}
	}
	/* Small four-pointed sparkles blinking on and off round the frame. */
	.sparkle {
		position: absolute;
		width: 12%;
		height: 12%;
		translate: -50% -50%;
		background: var(--frame-shine);
		clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%);
		opacity: 0;
		animation: frame-twinkle 1.8s ease-in-out infinite;
	}
	@keyframes frame-twinkle {
		0%,
		60%,
		100% {
			opacity: 0;
			scale: 0.4;
		}
		30% {
			opacity: 1;
			scale: 1;
		}
	}
	@keyframes frame-turn {
		to {
			rotate: 1turn;
		}
	}
	/* A band of light crossing the frame, cut to its outline. */
	.shine {
		position: absolute;
		inset: 0;
		overflow: hidden;
		mask-size: 100% 100%;
		mask-repeat: no-repeat;
	}
	.shine i {
		position: absolute;
		inset: 0;
		background: linear-gradient(105deg, transparent 40%, var(--frame-shine) 50%, transparent 60%);
		translate: -100% 0;
		animation: frame-shine 2.8s linear infinite;
	}
	@keyframes frame-shine {
		to {
			translate: 100% 0;
		}
	}
	/* Round the ring instead: a wedge of light turning about the centre, either way. */
	.shine:is([data-shimmer='shimmer-cw'], [data-shimmer='shimmer-ccw']) i {
		inset: -25%;
		background: conic-gradient(
			transparent 0deg 300deg,
			var(--frame-shine) 340deg,
			transparent 360deg
		);
		translate: none;
		animation: frame-turn 3.2s linear infinite;
	}
	.shine[data-shimmer='shimmer-ccw'] i {
		background: conic-gradient(
			transparent 0deg 20deg,
			var(--frame-shine) 20deg,
			transparent 60deg 360deg
		);
		animation-direction: reverse;
	}
	@media (prefers-reduced-motion: reduce) {
		.frame-drawing[data-motion],
		.shine i {
			animation: none;
		}
		.frame-drawing[data-motion='regrow'] {
			mask-image: none;
		}
		.shine,
		.sparkle {
			display: none;
		}
	}
</style>

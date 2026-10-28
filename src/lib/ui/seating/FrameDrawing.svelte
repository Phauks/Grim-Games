<script lang="ts">
	import { frameMaskSvg, type Frame } from '#lib/core/frames/index.ts';

	/**
	 * A frame's drawing (`core/frames`), filling the box it is placed in, and its motion
	 * (Trevor, 2026-10-28): the whole drawing rocking on its foot, or a light sweeping across
	 * it inside its own outline. Both are CSS transforms, so a full town of them stays smooth.
	 * Purely decorative: the seat's label says everything, so it is hidden from screen readers.
	 */
	let { frame }: { frame: Frame } = $props();

	const sway = $derived(frame.motion === 'sway' || frame.motion === 'sway-shimmer');
	const shimmer = $derived(frame.motion === 'shimmer' || frame.motion === 'sway-shimmer');
	const mask = $derived(
		shimmer ? `url("data:image/svg+xml,${encodeURIComponent(frameMaskSvg(frame))}")` : undefined
	);
</script>

<span class="frame-drawing" data-sway={sway || undefined} aria-hidden="true">
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
	{#if mask}<span class="shine" data-shimmer style:mask-image={mask}><i></i></span>{/if}
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
	/* Rocks on the wreath's foot, where its two branches meet. */
	.frame-drawing[data-sway] {
		transform-origin: 50% 93%;
		animation: frame-sway 3.2s ease-in-out infinite alternate;
	}
	@keyframes frame-sway {
		from {
			rotate: -2deg;
		}
		to {
			rotate: 2deg;
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
	@media (prefers-reduced-motion: reduce) {
		.frame-drawing[data-sway],
		.shine i {
			animation: none;
		}
		.shine {
			display: none;
		}
	}
</style>

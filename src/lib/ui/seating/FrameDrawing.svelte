<script lang="ts">
	import type { Frame } from '#lib/core/frames/index.ts';

	/**
	 * A frame's drawing (`core/frames`), filling the box it is placed in. Purely decorative:
	 * the seat's label says everything, so it is hidden from screen readers.
	 */
	let { frame }: { frame: Frame } = $props();
</script>

<svg class="frame" viewBox="0 0 100 100" aria-hidden="true" data-frame={frame.id}>
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

<style>
	.frame {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}
</style>

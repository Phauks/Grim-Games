<script lang="ts">
	import type { ScenePoint } from './scene-shapes.ts';

	/** Faint stars that twinkle, for the CSS scenes' night skies (moving backgrounds, L113). */
	interface Props {
		stars: ScenePoint[];
	}

	let { stars }: Props = $props();
</script>

{#each stars as star, i (i)}
	<span
		style:left="{star.left}%"
		style:top="{star.top}%"
		style:--size="{star.size}cqmin"
		style:animation-duration="{star.dur}s"
		style:animation-delay="{star.delay}s"
	></span>
{/each}

<style>
	span {
		position: absolute;
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
		background: oklch(0.95 0.02 260);
		animation: scene-twinkle ease-in-out infinite alternate;
	}
</style>

<script lang="ts">
	import { leafLayout, type LeafMarks } from './leaves.ts';

	interface Props {
		/** Icon image URL; the face stays (empty) when there is none. */
		src?: string;
		/** Accessible name: the character and what the leaves say. */
		label: string;
		leaves: LeafMarks;
		/** Fixed size in px, so the token never changes size when data or icons arrive. */
		size?: number;
	}

	let { src, label, leaves, size = 56 }: Props = $props();
	const layout = $derived(leafLayout(leaves));
	// A leaf pointing up from (0,0) to (0,-19), with a midrib.
	const LEAF = 'M0 0 C7 -5 7 -13 0 -19 C-7 -13 -7 -5 0 0 Z';
</script>

<span class="token" role="img" aria-label={label} style:--token-size="{size}px">
	<svg viewBox="0 0 100 100" aria-hidden="true">
		{#each layout as leaf, i (i)}
			<g
				class="leaf"
				data-kind={leaf.kind}
				transform="rotate({leaf.angle + 90} 50 50) translate(50 20)"
			>
				<path d={LEAF} />
				<path class="rib" d="M0 -2 L0 -16" />
			</g>
		{/each}
		<circle class="face" cx="50" cy="50" r="31" />
	</svg>
	{#if src}<img {src} alt="" width={size} height={size} loading="lazy" />{/if}
</span>

<style>
	.token {
		position: relative;
		display: inline-block;
		flex: none;
		width: var(--token-size);
		height: var(--token-size);
	}
	svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.face {
		fill: var(--token-face);
		stroke: var(--token-face-shade, var(--border));
		stroke-width: 2;
	}
	.leaf path {
		fill: var(--leaf);
	}
	.leaf[data-kind='setup'] path {
		fill: var(--leaf-setup);
	}
	.leaf .rib {
		fill: none;
		stroke: var(--token-face);
		stroke-width: 1;
		opacity: 0.6;
	}
	img {
		position: absolute;
		left: 23%;
		top: 23%;
		width: 54%;
		height: 54%;
		object-fit: contain;
	}
</style>

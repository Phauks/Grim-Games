<script lang="ts">
	import { FLOWER_ANGLE, leafLayout, type LeafMarks } from './leaves.ts';

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
	// A leaf pointing up from (0,0) to (0,-19), with a midrib. Leaves hang from the rim of the
	// face towards the middle, always inside the token (Trevor, 2026-10-15).
	const LEAF = 'M0 0 C7 -5 7 -13 0 -19 C-7 -13 -7 -5 0 0 Z';
	// The setup flower: five petals round a centre, inside the face at the bottom right.
	const FLOWER_R = 36;
	const flowerX = 50 + FLOWER_R * Math.cos((FLOWER_ANGLE * Math.PI) / 180);
	const flowerY = 50 + FLOWER_R * Math.sin((FLOWER_ANGLE * Math.PI) / 180);
	const PETALS = [0, 72, 144, 216, 288];
</script>

<!-- The user's Character token size (--token-scale, Settings) scales every token. -->
<span
	class="token"
	role="img"
	aria-label={label}
	style:--token-size="calc({size}px * var(--token-scale, 1))"
>
	<svg viewBox="0 0 100 100" aria-hidden="true">
		<circle class="face" cx="50" cy="50" r="48" />
	</svg>
	<!-- The icon fills most of the face, as on a real token (Trevor, 2026-10-16). -->
	{#if src}<img {src} alt="" width={size} height={size} loading="lazy" />{/if}
	<!-- Leaves and the flower are drawn over the icon, so they always show. -->
	<svg class="marks" viewBox="0 0 100 100" aria-hidden="true">
		{#each layout as leaf, i (i)}
			<g
				class="leaf"
				data-kind={leaf.kind}
				transform="rotate({leaf.angle + 90} 50 50) translate(50 5) rotate(180) scale(0.8)"
			>
				<path d={LEAF} />
				<path class="rib" d="M0 -2 L0 -16" />
			</g>
		{/each}
		{#if leaves.setup}
			<g class="flower" data-kind="setup" transform="translate({flowerX} {flowerY})">
				{#each PETALS as angle (angle)}
					<ellipse cx="0" cy="-4.2" rx="2.8" ry="4.2" transform="rotate({angle})" />
				{/each}
				<circle class="centre" r="2.4" />
			</g>
		{/if}
	</svg>
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
	}
	.face {
		fill: var(--token-face);
		stroke: var(--token-face-shade, var(--border));
		stroke-width: 2;
	}
	.leaf path {
		fill: var(--leaf);
	}
	.flower ellipse {
		fill: var(--token-flower);
	}
	.flower .centre {
		fill: var(--token-flower-centre);
	}
	.leaf .rib {
		fill: none;
		stroke: var(--token-face);
		stroke-width: 1;
		opacity: 0.6;
	}
	img {
		position: absolute;
		left: 13%;
		top: 13%;
		width: 74%;
		height: 74%;
		object-fit: contain;
	}
</style>

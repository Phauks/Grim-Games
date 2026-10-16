<script lang="ts">
	import type { NightMarker } from '#lib/core/data/index.ts';
	import { MARKER_TEXT } from '#lib/core/rules/night-order.ts';

	interface Props {
		/** Which night-order step: Dusk, Minion info, Demon info or Dawn. */
		marker: NightMarker;
		/** Fixed size in px, like character tokens. */
		size?: number;
		/** Accessible name; defaults to the step's name. Pass '' when a visible name sits beside it. */
		label?: string;
	}

	let { marker, size = 56, label }: Props = $props();
	const name = $derived(label ?? MARKER_TEXT[marker].name);
	// Our own art (Trevor, 2026-10-16): the same parchment face as a character token, with a
	// simple glyph. Dusk: the sun sinking under the horizon below the first stars. Dawn: the sun
	// rising with its rays. Minion info: two evil figures. Demon info: one horned evil figure.
	const RAYS = [-150, -120, -90, -60, -30].map((a) => (a * Math.PI) / 180);
	// The face (r 47) above and below the horizon at y 62: half-width √(47² − 12²) ≈ 45.4.
	const SKY = 'M4.6 62 A47 47 0 1 1 95.4 62 Z';
	const GROUND = 'M4.6 62 A47 47 0 0 0 95.4 62 Z';

	/** Head and shoulders of a figure centred on x, standing on y. */
	function figure(x: number, y: number, s: number) {
		return {
			head: { cx: x, cy: y - 26 * s, r: 9 * s },
			body: `M${x - 16 * s} ${y} Q${x - 16 * s} ${y - 16 * s} ${x} ${y - 16 * s} Q${x + 16 * s} ${y - 16 * s} ${x + 16 * s} ${y} Z`
		};
	}
	const pair = [figure(34, 76, 1), figure(66, 76, 1)];
	const demon = figure(50, 80, 1.3);
</script>

<span
	class="token"
	role={name ? 'img' : undefined}
	aria-label={name || undefined}
	aria-hidden={name ? undefined : 'true'}
	data-marker={marker}
	style:--token-size="{size}px"
>
	<svg viewBox="0 0 100 100" aria-hidden="true">
		<circle class="face" cx="50" cy="50" r="48" />
		{#if marker === 'dusk'}
			<path class="night-sky" d={SKY} />
			<path class="star" d="M30 24 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" />
			<path
				class="star"
				d="M70 18 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5 Z"
			/>
			<circle class="sun" cx="50" cy="70" r="17" />
		{:else if marker === 'dawn'}
			{#each RAYS as a (a)}
				<line
					class="ray"
					x1={50 + 23 * Math.cos(a)}
					y1={62 + 23 * Math.sin(a)}
					x2={50 + 35 * Math.cos(a)}
					y2={62 + 35 * Math.sin(a)}
				/>
			{/each}
			<circle class="sun" cx="50" cy="62" r="17" />
		{:else if marker === 'minioninfo'}
			{#each pair as f, i (i)}
				<circle class="figure" cx={f.head.cx} cy={f.head.cy} r={f.head.r} />
				<path class="figure" d={f.body} />
			{/each}
		{:else}
			<!-- Horns curving up and out from the head. -->
			<path class="figure" d="M43 38 Q33 30 34 14 Q40 27 48 33 Z" />
			<path class="figure" d="M57 38 Q67 30 66 14 Q60 27 52 33 Z" />
			<circle class="figure" cx={demon.head.cx} cy={demon.head.cy} r={demon.head.r} />
			<path class="figure" d={demon.body} />
		{/if}
		{#if marker === 'dusk' || marker === 'dawn'}
			<path class="ground" d={GROUND} />
			<line class="horizon" x1="8" y1="62" x2="92" y2="62" />
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
	.night-sky {
		fill: var(--good);
		opacity: 0.35;
	}
	.star {
		fill: var(--token-flower-centre);
	}
	.sun {
		fill: var(--token-flower);
	}
	.ray {
		stroke: var(--token-flower-centre);
		stroke-width: 4;
		stroke-linecap: round;
	}
	.ground {
		fill: var(--token-face-shade, var(--border));
	}
	.horizon {
		stroke: var(--on-token);
		stroke-width: 2.5;
		stroke-linecap: round;
	}
	.figure {
		fill: var(--evil);
	}
</style>

<script lang="ts">
	import type { NightMarker } from '#lib/core/data/index.ts';
	import { MARKER_TEXT } from '#lib/core/rules/night/night-order.ts';

	interface Props {
		/** Which night-order step: Dusk, Minion info, Demon info or Dawn. */
		marker: NightMarker;
		/** Fixed size in px, like character tokens. */
		size?: number;
		/** Accessible name; defaults to the step's name. Pass '' when a visible name sits beside it. */
		label?: string;
		/**
		 * Fills its box with the art alone, with no token face around it: the picture in a
		 * character piece's ring, where a character's icon fills it too (Trevor, 2026-11-08:
		 * "should fully fill character image space, not be within a token").
		 */
		fill?: boolean;
	}

	let { marker, size = 56, label, fill = false }: Props = $props();
	const name = $derived(label ?? MARKER_TEXT[marker].name);
	// Our own art (Trevor, 2026-10-16): the same parchment face as a character token, with a
	// simple glyph. Dusk: the sun sinking under the horizon below the first stars. Dawn: the sun
	// rising with its rays. Minion info and Demon info: a red M and a red D (Trevor, 2026-10-28).
	// Dawn and Dusk glow (Trevor, 2026-11-13, style B "although the sun will need more rays"): a
	// whole wheel of rays turns slowly behind the ground, the sun swells and the stars twinkle.
	const RAYS = Array.from({ length: 16 }, (_, i) => ((i * 22.5 + 11.25) * Math.PI) / 180);
	// The face (r 47) above and below the horizon at y 62: half-width √(47² − 12²) ≈ 45.4.
	const SKY = 'M4.6 62 A47 47 0 1 1 95.4 62 Z';
	const GROUND = 'M4.6 62 A47 47 0 0 0 95.4 62 Z';
</script>

<span
	class="token"
	role={name ? 'img' : undefined}
	aria-label={name || undefined}
	aria-hidden={name ? undefined : 'true'}
	data-marker={marker}
	data-fill={fill || undefined}
	style:--token-size={fill ? undefined : `${size}px`}
>
	<svg viewBox={fill ? '3 3 94 94' : '0 0 100 100'} aria-hidden="true">
		{#if !fill}<circle class="face" cx="50" cy="50" r="48" />{/if}
		{#if marker === 'dusk'}
			<path class="night-sky" d={SKY} />
			<path class="star" d="M30 24 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" />
			<path
				class="star second"
				d="M70 18 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5 Z"
			/>
			<circle class="sun" cx="50" cy="70" r="17" />
		{:else if marker === 'dawn'}
			<g class="rays">
				<!-- Sets the wheel's box, so it turns about the sun's centre. -->
				<circle class="wheel" cx="50" cy="62" r="36" />
				{#each RAYS as a (a)}
					<line
						class="ray"
						x1={50 + 23 * Math.cos(a)}
						y1={62 + 23 * Math.sin(a)}
						x2={50 + 35 * Math.cos(a)}
						y2={62 + 35 * Math.sin(a)}
					/>
				{/each}
			</g>
			<circle class="sun" cx="50" cy="62" r="17" />
		{:else}
			<text
				class="letter"
				x="50"
				y="52"
				font-size="60"
				text-anchor="middle"
				dominant-baseline="central">{marker === 'minioninfo' ? 'M' : 'D'}</text
			>
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
	.token[data-fill] {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		overflow: hidden;
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
	.wheel {
		fill: none;
	}
	.rays,
	.sun,
	.star {
		transform-box: fill-box;
		transform-origin: center;
	}
	/* Still when the device asks for less motion, and on paper. */
	@media (prefers-reduced-motion: no-preference) {
		.rays {
			animation: turn 24s linear infinite;
		}
		/* The day sun's slow swell (PlayersDayStatus). */
		.sun {
			animation: swell 4s ease-in-out infinite;
		}
		.star {
			animation: twinkle 2.6s ease-in-out infinite;
		}
		.star.second {
			animation-delay: -1.3s;
		}
	}
	@keyframes turn {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes swell {
		50% {
			transform: scale(1.08);
		}
	}
	@keyframes twinkle {
		50% {
			opacity: 0.35;
			transform: scale(0.7);
		}
	}
	.ground {
		fill: var(--token-face-shade, var(--border));
	}
	.horizon {
		stroke: var(--on-token);
		stroke-width: 2.5;
		stroke-linecap: round;
	}
	.letter {
		font-family: var(--font-character);
		font-weight: 700;
		fill: var(--evil);
	}
</style>

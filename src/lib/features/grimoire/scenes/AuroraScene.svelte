<script lang="ts">
	import { points, rand, range, treeline } from './scene-shapes.ts';
	import Twinklers from './Twinklers.svelte';

	/**
	 * Aurora (moving backgrounds, plan L113): three curtains of light over a forest edge, each a
	 * run of slices rippling in a travelling wave, under twinkling stars. Drawn in CSS.
	 */
	const stars = points(40, 100, [0.15, 0.35], [2.5, 6], [0, 62]);
	const curtains = range(3, (c) => ({
		base: [60, 54, 48][c],
		height: [34, 30, 26][c],
		hue: [150, 165, 180][c],
		dur: 34 + c * 9,
		delay: -c * 11,
		segs: range(9, (s) => ({
			left: -12 + s * 14 + rand(s, 110 + c) * 4,
			lift: (rand(s, 120 + c) - 0.5) * 6,
			dur: 8 + rand(s, 130 + c) * 3,
			delay: -(s * 0.9 + c * 2.3)
		}))
	}));
	const land = treeline(200, 40, 30, 4, 3.1, 64);
</script>

<div class="night"></div>
<Twinklers {stars} />
<div class="skyglow"></div>
{#each curtains as c, ci (ci)}
	<div
		class="curtain"
		style:--hue={c.hue}
		style:animation-duration="{c.dur}s"
		style:animation-delay="{c.delay}s"
	>
		{#each c.segs as s, si (si)}
			<div
				class="seg"
				style:left="{s.left}%"
				style:top="{c.base - c.height + s.lift}%"
				style:height="{c.height}%"
				style:animation-duration="{s.dur}s"
				style:animation-delay="{s.delay}s"
			></div>
		{/each}
	</div>
{/each}
<svg class="land" viewBox="0 0 200 40" preserveAspectRatio="xMidYMax slice">
	<path d={land} />
</svg>

<style>
	.night {
		inset: 0;
		background: linear-gradient(
			to bottom,
			oklch(0.06 0.02 250) 0%,
			oklch(0.1 0.03 220) 60%,
			oklch(0.15 0.04 200) 100%
		);
	}
	.skyglow {
		inset: 30% -20% 0;
		background: radial-gradient(
			ellipse 60% 40% at 50% 70%,
			oklch(0.45 0.1 160 / 0.25),
			transparent 70%
		);
	}
	.curtain {
		inset: 0 -10%;
		mix-blend-mode: screen;
		animation: curtain ease-in-out infinite alternate;
	}
	.seg {
		position: absolute;
		width: 17%;
		transform-origin: 50% 100%;
		background:
			repeating-linear-gradient(
				to right,
				transparent 0 0.6cqmin,
				oklch(0.95 0.1 calc(var(--hue) * 1) / 0.12) 0.9cqmin,
				transparent 1.4cqmin 2.2cqmin
			),
			linear-gradient(
				to top,
				transparent 0%,
				oklch(0.78 0.19 calc(var(--hue) * 1) / 0.75) 6%,
				oklch(0.7 0.17 calc(var(--hue) + 10) / 0.45) 26%,
				oklch(0.58 0.16 calc(var(--hue) + 50) / 0.3) 50%,
				oklch(0.5 0.18 300 / 0.2) 72%,
				transparent 100%
			);
		border-radius: 40% 40% 10% 10% / 60% 60% 6% 6%;
		filter: blur(1.6cqmin);
		animation: ripple ease-in-out infinite alternate;
	}
	.land {
		left: 0;
		bottom: 0;
		width: 100%;
		height: 24%;
		fill: oklch(0.05 0.015 210);
	}
	@keyframes curtain {
		from {
			transform: translateX(-6%);
		}
		to {
			transform: translateX(6%);
		}
	}
	@keyframes ripple {
		0% {
			transform: translateY(-3cqh) scaleY(0.88) skewX(-8deg);
			opacity: 0.5;
		}
		100% {
			transform: translateY(2cqh) scaleY(1.1) skewX(7deg);
			opacity: 1;
		}
	}
</style>

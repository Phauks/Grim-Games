<script lang="ts">
	import { rand, range } from './scene-shapes.ts';

	/**
	 * Tropical beach (moving backgrounds, plan L113): sun on the sea, glints on the water, foam
	 * washing up the sand and palms swaying. Drawn in CSS: every moving piece animates
	 * `transform` or `opacity`, which the compositor does, so nothing is painted again.
	 */
	const glints = range(26, (i) => ({
		left: rand(i, 10) * 100,
		top: 41 + rand(i, 11) * 24,
		width: 1.5 + rand(i, 12) * 5,
		duration: 1.8 + rand(i, 13) * 2.6,
		delay: -rand(i, 14) * 4
	}));
</script>

<div class="sky"></div>
<div class="sun"></div>
<div class="sea"></div>
{#each glints as g, i (i)}
	<span
		class="glint"
		style:left="{g.left}%"
		style:top="{g.top}%"
		style:width="{g.width}cqmin"
		style:animation-duration="{g.duration}s"
		style:animation-delay="{g.delay}s"
	></span>
{/each}
<div class="sand"></div>
<div class="wave w1"></div>
<div class="wave w2"></div>
<div class="wave w3"></div>
<svg class="palm left" viewBox="0 0 100 200" preserveAspectRatio="xMidYMax meet">
	<path class="trunk" d="M58 200 C 54 150, 50 110, 40 62" />
	<g class="fronds">
		<path d="M40 62 C 20 45, 6 50, -6 66 C 12 52, 26 54, 40 62Z" />
		<path d="M40 62 C 30 34, 12 26, 0 30 C 16 34, 28 44, 40 62Z" />
		<path d="M40 62 C 46 34, 64 22, 82 26 C 66 32, 52 42, 40 62Z" />
		<path d="M40 62 C 62 48, 84 52, 100 70 C 82 58, 62 56, 40 62Z" />
		<path d="M40 62 C 44 46, 40 30, 30 18 C 44 28, 48 44, 40 62Z" />
	</g>
</svg>
<svg class="palm right" viewBox="0 0 100 200" preserveAspectRatio="xMidYMax meet">
	<path class="trunk" d="M44 200 C 48 150, 54 112, 62 70" />
	<g class="fronds">
		<path d="M62 70 C 42 52, 22 56, 6 74 C 24 60, 42 62, 62 70Z" />
		<path d="M62 70 C 52 42, 32 32, 18 36 C 34 42, 50 52, 62 70Z" />
		<path d="M62 70 C 68 42, 86 30, 104 34 C 88 40, 74 50, 62 70Z" />
		<path d="M62 70 C 82 58, 100 62, 112 78 C 96 68, 80 66, 62 70Z" />
	</g>
</svg>

<style>
	.sky {
		inset: 0 0 55% 0;
		background: linear-gradient(
			to bottom,
			oklch(0.5 0.1 235) 0%,
			oklch(0.7 0.09 215) 60%,
			oklch(0.86 0.08 80) 100%
		);
	}
	.sun {
		left: 58%;
		top: 26%;
		width: 22cqmin;
		height: 22cqmin;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			oklch(0.98 0.06 95) 0 38%,
			oklch(0.9 0.12 85 / 0.5) 52%,
			transparent 70%
		);
		animation: scene-pulse 4s ease-in-out infinite alternate;
	}
	.sea {
		inset: 45% 0 28% 0;
		background: linear-gradient(
			to bottom,
			oklch(0.62 0.11 210) 0%,
			oklch(0.6 0.12 195) 55%,
			oklch(0.72 0.11 180) 100%
		);
	}
	.glint {
		height: 0.35cqmin;
		border-radius: 1cqmin;
		background: oklch(0.97 0.04 95);
		animation: glint ease-in-out infinite alternate;
	}
	.sand {
		inset: 70% 0 0 0;
		background: linear-gradient(
			to bottom,
			oklch(0.8 0.07 85) 0%,
			oklch(0.74 0.08 75) 60%,
			oklch(0.66 0.08 65) 100%
		);
	}
	/* A foam edge: a scalloped band that washes up the sand and back. */
	.wave {
		left: -20%;
		width: 140%;
		height: 6cqh;
		top: 67%;
		background: linear-gradient(
			to bottom,
			oklch(0.8 0.08 190 / 0) 0%,
			oklch(0.9 0.05 190 / 0.5) 55%,
			oklch(0.98 0.02 200) 80%,
			oklch(0.98 0.02 200 / 0) 100%
		);
		border-radius: 0 0 50% 45% / 0 0 100% 80%;
		opacity: 0.85;
		animation: wash 6s ease-in-out infinite;
	}
	.w2 {
		animation-delay: -2s;
		opacity: 0.6;
		top: 68.5%;
	}
	.w3 {
		animation-delay: -4s;
		opacity: 0.4;
		top: 70%;
	}
	.palm {
		bottom: 0;
		height: 62%;
		width: 34%;
	}
	.palm.left {
		left: -6%;
	}
	.palm.right {
		right: -8%;
		height: 50%;
	}
	.trunk {
		fill: none;
		stroke: oklch(0.22 0.03 60);
		stroke-width: 5;
		stroke-linecap: round;
	}
	.fronds {
		fill: oklch(0.24 0.06 150);
		transform-box: fill-box;
		transform-origin: 50% 60%;
		animation: sway 5s ease-in-out infinite alternate;
	}
	.right .fronds {
		animation-delay: -2.5s;
	}
	@keyframes glint {
		from {
			opacity: 0;
			transform: translateX(-1cqmin);
		}
		to {
			opacity: 0.9;
			transform: translateX(1cqmin);
		}
	}
	@keyframes wash {
		0%,
		100% {
			transform: translate(0, 2.5cqh) scaleY(0.7);
		}
		50% {
			transform: translate(-4cqmin, -1cqh) scaleY(1);
		}
	}
	@keyframes sway {
		from {
			transform: rotate(-3deg);
		}
		to {
			transform: rotate(3deg);
		}
	}
</style>

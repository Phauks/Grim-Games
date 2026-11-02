<script lang="ts">
	/**
	 * SPIKE (animated backgrounds, not for merge). Option A: a scene drawn and moved in CSS
	 * only. Every moving layer animates `transform` or `opacity`, which the browser hands to
	 * the compositor, so nothing is painted again frame by frame.
	 */
	interface Props {
		scene: 'hellfire' | 'beach';
		/** Still: the scene's resting frame (reduced motion, or the switch off). */
		still?: boolean;
		contained?: boolean;
	}
	let { scene, still = false, contained = false }: Props = $props();

	// A fixed scatter, so every render (and every screenshot) is the same.
	const rand = (i: number, salt: number) => {
		const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
		return x - Math.floor(x);
	};
	const embers = Array.from({ length: 34 }, (_, i) => ({
		left: rand(i, 1) * 100,
		size: 0.35 + rand(i, 2) * 0.6,
		duration: 7 + rand(i, 3) * 9,
		delay: -rand(i, 4) * 16,
		drift: (rand(i, 5) - 0.5) * 18
	}));
	const flames = Array.from({ length: 11 }, (_, i) => ({
		left: -14 + i * 11 + rand(i, 6) * 5,
		height: 40 + rand(i, 7) * 28,
		duration: 1.6 + rand(i, 8) * 1.4,
		delay: -rand(i, 9) * 3
	}));
	const glints = Array.from({ length: 26 }, (_, i) => ({
		left: rand(i, 10) * 100,
		top: 41 + rand(i, 11) * 24,
		width: 1.5 + rand(i, 12) * 5,
		duration: 1.8 + rand(i, 13) * 2.6,
		delay: -rand(i, 14) * 4
	}));
</script>

<div class="scene {scene}" class:still class:contained aria-hidden="true">
	{#if scene === 'hellfire'}
		<div class="sky"></div>
		<div class="glow"></div>
		{#each flames as f, i (i)}
			<div
				class="flame"
				style:left="{f.left}%"
				style:height="{f.height}%"
				style:animation-duration="{f.duration}s"
				style:animation-delay="{f.delay}s"
			></div>
		{/each}
		{#each embers as e, i (i)}
			<span
				class="ember"
				style:left="{e.left}%"
				style:--size="{e.size}vmin"
				style:--drift="{e.drift}vw"
				style:animation-duration="{e.duration}s"
				style:animation-delay="{e.delay}s"
			></span>
		{/each}
	{:else}
		<div class="sky"></div>
		<div class="sun"></div>
		<div class="sea"></div>
		{#each glints as g, i (i)}
			<span
				class="glint"
				style:left="{g.left}%"
				style:top="{g.top}%"
				style:width="{g.width}vmin"
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
	{/if}
</div>

<style>
	.scene {
		position: fixed;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		pointer-events: none;
		/* Dimmed like an image, so seat names and labels stay readable. */
		filter: brightness(0.62) saturate(0.95);
		contain: strict;
	}
	.contained {
		position: absolute;
	}
	.scene > * {
		position: absolute;
	}
	.still *,
	.still *::before {
		animation-play-state: paused !important;
	}

	/* ── Hellfire ── */
	.hellfire .sky {
		inset: 0;
		background: linear-gradient(
			to bottom,
			oklch(0.1 0.02 20) 0%,
			oklch(0.2 0.08 25) 35%,
			oklch(0.38 0.16 32) 70%,
			oklch(0.5 0.18 40) 100%
		);
	}
	.hellfire .glow {
		inset: 20% -20% -20% -20%;
		background: radial-gradient(
			ellipse 60% 60% at 50% 100%,
			oklch(0.72 0.19 50 / 0.85),
			transparent 70%
		);
		animation: pulse 3.2s ease-in-out infinite alternate;
	}
	.flame {
		bottom: -4%;
		width: 26%;
		transform-origin: 50% 100%;
		background: radial-gradient(
			ellipse 50% 60% at 50% 100%,
			oklch(0.92 0.13 90) 0%,
			oklch(0.78 0.18 60) 25%,
			oklch(0.58 0.21 35 / 0.8) 55%,
			transparent 75%
		);
		border-radius: 50% 50% 40% 40% / 70% 70% 30% 30%;
		filter: blur(1.2vmin);
		mix-blend-mode: screen;
		animation: lick ease-in-out infinite alternate;
	}
	.ember {
		bottom: -2vh;
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
		background: oklch(0.9 0.15 80);
		box-shadow: 0 0 calc(var(--size) * 2) oklch(0.75 0.2 50);
		animation: rise linear infinite;
	}
	@keyframes pulse {
		from {
			opacity: 0.65;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes lick {
		0% {
			transform: scale(1, 0.85) skewX(-4deg);
		}
		50% {
			transform: scale(0.92, 1.12) skewX(3deg);
		}
		100% {
			transform: scale(1.05, 0.95) skewX(-2deg);
		}
	}
	@keyframes rise {
		0% {
			transform: translate(0, 0);
			opacity: 0;
		}
		10% {
			opacity: 1;
		}
		70% {
			opacity: 0.8;
		}
		100% {
			transform: translate(var(--drift), -105vh);
			opacity: 0;
		}
	}

	/* ── Tropical beach ── */
	.beach .sky {
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
		width: 22vmin;
		height: 22vmin;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			oklch(0.98 0.06 95) 0 38%,
			oklch(0.9 0.12 85 / 0.5) 52%,
			transparent 70%
		);
		animation: pulse 4s ease-in-out infinite alternate;
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
		height: 0.35vmin;
		border-radius: 1vmin;
		background: oklch(0.97 0.04 95);
		animation: twinkle ease-in-out infinite alternate;
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
		height: 6vh;
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
	@keyframes twinkle {
		from {
			opacity: 0;
			transform: translateX(-1vmin);
		}
		to {
			opacity: 0.9;
			transform: translateX(1vmin);
		}
	}
	@keyframes wash {
		0%,
		100% {
			transform: translate(0, 2.5vh) scaleY(0.7);
		}
		50% {
			transform: translate(-4vmin, -1vh) scaleY(1);
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

	/* The operating system's Reduce motion wins: the scene rests on its still frame. */
	@media (prefers-reduced-motion: reduce) {
		.scene *,
		.scene *::before {
			animation-play-state: paused !important;
		}
	}
</style>

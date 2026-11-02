<script lang="ts">
	import { rand, range, treeline } from './scene-shapes.ts';

	/**
	 * Sunset clouds (moving backgrounds, plan L113): a low sun behind a forest edge, two decks
	 * of cloud drifting past and birds gliding across. Drawn in CSS; each cloud deck is a 300%
	 * wide repeating layer that slides one tile, a seamless loop.
	 */
	const land = treeline(200, 30, 20, 3, 8.8, 26);
	const birds = range(3, (i) => ({
		top: 22 + i * 7 + rand(i, 200) * 4,
		dur: 50 + rand(i, 201) * 25,
		delay: -rand(i, 202) * 70,
		flap: 0.7 + rand(i, 203) * 0.4
	}));
</script>

<div class="sky"></div>
<div class="sunglow"></div>
<div class="sun"></div>
<div class="clouds high"></div>
<div class="clouds low"></div>
{#each birds as b, i (i)}
	<div
		class="bird"
		style:top="{b.top}%"
		style:animation-duration="{b.dur}s"
		style:animation-delay="{b.delay}s"
	>
		<svg viewBox="0 0 20 8" style:animation-duration="{b.flap}s">
			<path d="M0 2 Q5 0 10 6 Q15 0 20 2 Q15 2 10 8 Q5 2 0 2Z" />
		</svg>
	</div>
{/each}
<svg class="land" viewBox="0 0 200 30" preserveAspectRatio="xMidYMax slice">
	<path d={land} />
</svg>

<style>
	.sky {
		inset: 0;
		background: linear-gradient(
			to bottom,
			oklch(0.2 0.07 300) 0%,
			oklch(0.36 0.11 320) 30%,
			oklch(0.55 0.16 15) 58%,
			oklch(0.7 0.16 45) 78%,
			oklch(0.78 0.14 65) 100%
		);
	}
	.sunglow {
		left: calc(50% - 50cqmax);
		top: calc(78% - 50cqmax);
		width: 100cqmax;
		height: 100cqmax;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			oklch(0.88 0.13 75 / 0.6),
			oklch(0.75 0.15 50 / 0.25) 30%,
			transparent 60%
		);
		animation: scene-pulse 6s ease-in-out infinite alternate;
	}
	.sun {
		left: calc(50% - 9cqmin);
		top: calc(78% - 9cqmin);
		width: 18cqmin;
		height: 18cqmin;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			oklch(0.98 0.06 95) 0 60%,
			oklch(0.92 0.11 80 / 0.5) 68%,
			transparent 72%
		);
	}
	.clouds {
		left: 0;
		width: 300%;
		background-image:
			radial-gradient(ellipse 24% 22% at 24% 50%, var(--c), transparent 70%),
			radial-gradient(ellipse 18% 14% at 46% 38%, var(--c), transparent 70%),
			radial-gradient(ellipse 22% 18% at 58% 66%, var(--e), transparent 70%),
			radial-gradient(ellipse 24% 20% at 78% 46%, var(--c), transparent 70%),
			radial-gradient(ellipse 16% 10% at 36% 72%, var(--e), transparent 70%);
		background-repeat: repeat-x;
		background-size: 33.3333% 100%;
		filter: blur(1cqmin);
		animation: scene-loopx linear infinite;
	}
	.high {
		--c: oklch(0.32 0.09 320 / 0.75);
		--e: oklch(0.55 0.13 10 / 0.6);
		top: 8%;
		height: 36%;
		animation-duration: 170s;
	}
	.low {
		--c: oklch(0.62 0.15 30 / 0.6);
		--e: oklch(0.8 0.12 60 / 0.55);
		top: 46%;
		height: 26%;
		background-position: 55% 0;
		animation-duration: 115s;
	}
	.bird {
		left: -6%;
		width: 3cqmin;
		height: 1.2cqmin;
		animation: glide linear infinite;
	}
	.bird svg {
		width: 100%;
		height: 100%;
		fill: oklch(0.15 0.04 320);
		animation: flap ease-in-out infinite alternate;
	}
	.land {
		left: 0;
		bottom: 0;
		width: 100%;
		height: 16%;
		fill: oklch(0.1 0.04 330);
	}
	@keyframes glide {
		from {
			transform: translate(0, 0);
		}
		to {
			transform: translate(112cqw, -6cqh);
		}
	}
	@keyframes flap {
		from {
			transform: scaleY(1);
		}
		to {
			transform: scaleY(-0.4);
		}
	}
</style>

<script lang="ts">
	import { f1, points, rand, ridge, ridgeY } from './scene-shapes.ts';
	import Twinklers from './Twinklers.svelte';

	/**
	 * Graveyard fog (moving backgrounds, plan L113): a moonlit hill of headstones with banks of
	 * mist drifting between the rows. Drawn in CSS; each mist bank is a 300% wide repeating
	 * layer that slides one tile, a seamless loop.
	 */
	const stars = points(16, 150, [0.15, 0.3], [3, 7], [0, 45]);

	/** A headstone: rounded, a cross or pointed, by `kind` from 0 to 1. */
	function stone(x: number, b: number, h: number, w: number, kind: number) {
		if (kind < 0.5)
			return `M${f1(x - w)} ${f1(b)} V${f1(b - h + w)} A${f1(w)} ${f1(w)} 0 0 1 ${f1(x + w)} ${f1(b - h + w)} V${f1(b)} Z`;
		if (kind < 0.75) {
			const t = w * 0.35;
			const arm = b - h * 0.72;
			return `M${f1(x - t)} ${f1(b)} V${f1(arm + t)} H${f1(x - w)} V${f1(arm - t)} H${f1(x - t)} V${f1(b - h)} H${f1(x + t)} V${f1(arm - t)} H${f1(x + w)} V${f1(arm + t)} H${f1(x + t)} V${f1(b)} Z`;
		}
		return `M${f1(x - w)} ${f1(b)} L${f1(x - w * 0.7)} ${f1(b - h * 0.8)} L${f1(x)} ${f1(b - h)} L${f1(x + w * 0.7)} ${f1(b - h * 0.8)} L${f1(x + w)} ${f1(b)} Z`;
	}
	/** A row of `n` headstones along a ridge. */
	function row(n: number, salt: number, base: number, scale: number) {
		let d = '';
		for (let i = 0; i < n; i++) {
			const x = (i + 0.3 + rand(i, salt) * 0.4) * (200 / n);
			const b = ridgeY(x, base, 1.5, salt) + 1;
			d += stone(
				x,
				b,
				(7 + rand(i, salt + 1) * 7) * scale,
				(2.5 + rand(i, salt + 2) * 1.5) * scale,
				rand(i, salt + 3)
			);
		}
		return d;
	}
	const hill = ridge(200, 60, 38, 6, 3.3);
	const back = ridge(200, 60, 50, 1.5, 7.7) + row(12, 160, 50, 0.6);
	const front = ridge(200, 60, 56, 1.5, 9.1) + row(9, 170, 56, 1);
</script>

<div class="sky"></div>
<Twinklers {stars} />
<div class="moonglow"></div>
<div class="moon"></div>
<svg class="hill" viewBox="0 0 200 60" preserveAspectRatio="xMidYMax slice">
	<path d={hill} />
</svg>
<div class="mist m1"></div>
<svg class="yard back" viewBox="0 0 200 60" preserveAspectRatio="xMidYMax slice">
	<path d={back} />
</svg>
<div class="mist m2"></div>
<svg class="yard front" viewBox="0 0 200 60" preserveAspectRatio="xMidYMax slice">
	<path d={front} />
	<path
		class="tree"
		d="M178 57 C 177 46, 179 38, 176 28 M177 40 C 171 36, 168 33, 163 32 M176 33 C 182 28, 186 27, 190 22 M176 28 C 174 22, 172 20, 170 16 M171 34 L 166 28"
	/>
</svg>
<div class="mist m3"></div>

<style>
	.sky {
		inset: 0;
		background: linear-gradient(
			to bottom,
			oklch(0.26 0.03 205) 0%,
			oklch(0.18 0.025 200) 55%,
			oklch(0.12 0.02 195) 100%
		);
	}
	.moonglow {
		left: calc(18% - 35cqmin);
		top: calc(14% - 35cqmin);
		width: 70cqmin;
		height: 70cqmin;
		border-radius: 50%;
		background: radial-gradient(circle, oklch(0.7 0.04 190 / 0.4), transparent 65%);
		animation: scene-pulse 7s ease-in-out infinite alternate;
	}
	.moon {
		left: calc(18% - 7cqmin);
		top: calc(14% - 7cqmin);
		width: 14cqmin;
		height: 14cqmin;
		border-radius: 50%;
		background:
			radial-gradient(circle at 34% 40%, oklch(0.8 0.02 110 / 0.6) 0 10%, transparent 12%),
			radial-gradient(circle at 62% 62%, oklch(0.82 0.02 110 / 0.5) 0 14%, transparent 16%),
			radial-gradient(circle at 60% 30%, oklch(0.84 0.02 110 / 0.5) 0 6%, transparent 8%),
			radial-gradient(circle, oklch(0.94 0.03 105) 0 66%, oklch(0.88 0.03 105 / 0) 71%);
	}
	.hill {
		left: 0;
		bottom: 0;
		width: 100%;
		height: 34%;
		fill: oklch(0.13 0.02 200);
	}
	.yard {
		left: 0;
		bottom: 0;
		width: 100%;
		height: 30%;
	}
	.yard.back {
		fill: oklch(0.1 0.02 200);
	}
	.yard.front {
		fill: oklch(0.04 0.01 200);
	}
	.tree {
		fill: none;
		stroke: oklch(0.04 0.01 200);
		stroke-width: 1.4;
		stroke-linecap: round;
	}
	.mist {
		left: 0;
		width: 300%;
		background-image:
			radial-gradient(ellipse 28% 50% at 22% 60%, var(--c), transparent 70%),
			radial-gradient(ellipse 22% 40% at 50% 45%, var(--c), transparent 70%),
			radial-gradient(ellipse 28% 55% at 78% 62%, var(--c), transparent 70%),
			linear-gradient(to top, var(--c), transparent 70%);
		background-repeat: repeat-x;
		background-size: 33.3333% 100%;
		filter: blur(2cqmin);
		animation:
			scene-loopx linear infinite,
			scene-pulse ease-in-out infinite alternate;
	}
	.m1 {
		--c: oklch(0.5 0.03 195 / 0.35);
		bottom: 8%;
		height: 30%;
		animation-duration: 90s, 9s;
	}
	.m2 {
		--c: oklch(0.55 0.03 195 / 0.38);
		bottom: -2%;
		height: 24%;
		background-position: 45% 0;
		animation-duration: 60s, 7s;
		animation-direction: reverse, alternate;
	}
	.m3 {
		--c: oklch(0.6 0.03 195 / 0.42);
		bottom: -6%;
		height: 18%;
		background-position: 20% 0;
		animation-duration: 38s, 5.5s;
		animation-delay:
			-12s,
			-3s;
	}
</style>

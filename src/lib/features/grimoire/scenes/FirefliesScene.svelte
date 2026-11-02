<script lang="ts">
	import { f1, rand, range, ridge, ridgeY } from './scene-shapes.ts';

	/**
	 * Firefly wood (moving backgrounds, plan L113): fireflies wander and blink among dark
	 * trunks over moonlit mist. Drawn in CSS.
	 */
	const trunksBack = range(9, (i) => {
		const x = 4 + i * 11.5 + rand(i, 210) * 5;
		const w = 1 + rand(i, 211) * 1.2;
		return `M${f1(x - w)} 100 L${f1(x - w * 0.7)} 0 L${f1(x + w * 0.7)} 0 L${f1(x + w)} 100 Z`;
	}).join(' ');
	const trunksFront = [6, 31, 72, 94]
		.map((x, i) => {
			const w = 2.4 + rand(i, 212) * 1.8;
			return `M${f1(x - w * 1.9)} 100 Q${f1(x - w)} 94 ${f1(x - w)} 84 L${f1(x - w * 0.75)} 0 L${f1(x + w * 0.75)} 0 L${f1(x + w)} 84 Q${f1(x + w)} 94 ${f1(x + w * 1.9)} 100 Z`;
		})
		.join(' ');
	const undergrowth = (() => {
		let d = ridge(200, 40, 30, 3, 1.9, 60);
		for (let i = 0; i < 46; i++) {
			const x = i * 4.4 + rand(i, 220) * 3;
			const b = ridgeY(x, 30, 3, 1.9) + 1;
			const h = 4 + rand(i, 221) * 7;
			const lean = (rand(i, 222) - 0.5) * 5;
			d += ` M${f1(x - 0.6)} ${f1(b)} Q${f1(x + lean * 0.3)} ${f1(b - h * 0.6)} ${f1(x + lean)} ${f1(b - h)} Q${f1(x + lean * 0.3 + 0.8)} ${f1(b - h * 0.5)} ${f1(x + 0.6)} ${f1(b)} Z`;
		}
		return d;
	})();
	const flies = range(30, (i) => {
		const r = (s: number) => (rand(i, s) - 0.5) * 22;
		return {
			left: rand(i, 230) * 100,
			top: 28 + rand(i, 231) * 66,
			size: 1.6 + rand(i, 232) * 1.2,
			dur: 16 + rand(i, 233) * 16,
			delay: -rand(i, 234) * 32,
			x1: r(235),
			y1: r(236),
			x2: r(237),
			y2: r(238),
			x3: r(239),
			y3: r(240),
			blink: 2.5 + rand(i, 241) * 3.5,
			blinkDelay: -rand(i, 242) * 6
		};
	});
</script>

<div class="sky"></div>
<div class="moonlight"></div>
<svg class="trunks back" viewBox="0 0 100 100" preserveAspectRatio="none">
	<path d={trunksBack} />
</svg>
<div class="groundmist"></div>
<svg class="trunks front" viewBox="0 0 100 100" preserveAspectRatio="none">
	<path d={trunksFront} />
</svg>
<svg class="brush" viewBox="0 0 200 40" preserveAspectRatio="xMidYMax slice">
	<path d={undergrowth} />
</svg>
{#each flies as f, i (i)}
	<span
		class="fly"
		style:left="{f.left}%"
		style:top="{f.top}%"
		style:--size="{f.size}cqmin"
		style:--x1="{f.x1}cqmin"
		style:--y1="{f.y1}cqmin"
		style:--x2="{f.x2}cqmin"
		style:--y2="{f.y2}cqmin"
		style:--x3="{f.x3}cqmin"
		style:--y3="{f.y3}cqmin"
		style:--blink="{f.blink}s"
		style:--blink-delay="{f.blinkDelay}s"
		style:animation-duration="{f.dur}s"
		style:animation-delay="{f.delay}s"
	></span>
{/each}

<style>
	.sky {
		inset: 0;
		background: linear-gradient(
			to bottom,
			oklch(0.16 0.035 165) 0%,
			oklch(0.12 0.03 160) 55%,
			oklch(0.08 0.02 150) 100%
		);
	}
	.moonlight {
		inset: -30% -10% 40%;
		background: radial-gradient(
			ellipse 50% 50% at 60% 30%,
			oklch(0.4 0.05 170 / 0.4),
			transparent 70%
		);
	}
	.trunks {
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.trunks.back {
		fill: oklch(0.1 0.025 160);
	}
	.trunks.front {
		fill: oklch(0.05 0.015 150);
	}
	.groundmist {
		inset: 55% -10% 0;
		background: linear-gradient(to bottom, transparent, oklch(0.3 0.04 160 / 0.4) 60%);
	}
	.brush {
		left: 0;
		bottom: 0;
		width: 100%;
		height: 18%;
		fill: oklch(0.05 0.015 150);
	}
	.fly {
		width: var(--size);
		height: var(--size);
		translate: -50% -50%;
		animation: wander ease-in-out infinite alternate;
	}
	.fly::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			oklch(0.98 0.12 115) 0 12%,
			oklch(0.88 0.19 125 / 0.6) 22%,
			oklch(0.8 0.18 130 / 0) 70%
		);
		opacity: 0;
		animation: blink var(--blink) ease-in-out var(--blink-delay) infinite;
	}
	@keyframes wander {
		0% {
			transform: translate(0, 0);
		}
		33% {
			transform: translate(var(--x1), var(--y1));
		}
		66% {
			transform: translate(var(--x2), var(--y2));
		}
		100% {
			transform: translate(var(--x3), var(--y3));
		}
	}
	@keyframes blink {
		0%,
		30%,
		100% {
			opacity: 0.05;
		}
		50% {
			opacity: 1;
		}
		70% {
			opacity: 0.3;
		}
	}
</style>

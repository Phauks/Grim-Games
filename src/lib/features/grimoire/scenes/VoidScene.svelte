<script lang="ts">
	import { f1, rand, range } from './scene-shapes.ts';

	/**
	 * Arcane void (moving backgrounds, plan L113): spiral arms turning slowly round a breathing
	 * core, with motes in orbit. Drawn in CSS: only rotation, scale and opacity move.
	 */
	function spiral(arms: number, curl: number, salt: number) {
		return range(arms, (k) => {
			const t0 = (k / arms) * Math.PI * 2 + rand(k, salt) * 0.4;
			let d = '';
			for (let s = 0; s <= 40; s++) {
				const r = 3 + s * 1.15;
				const t = t0 + curl * r * 0.09;
				d += `${s ? ' L' : 'M'}${f1(Math.cos(t) * r)} ${f1(Math.sin(t) * r)}`;
			}
			return d;
		});
	}
	const armsWide = spiral(5, 1, 250);
	const armsThin = spiral(3, -1.3, 260);
	const motes = range(40, (i) => ({
		r: 8 + rand(i, 270) * 52,
		start: rand(i, 271) * 360,
		size: 0.3 + rand(i, 272) * 0.45,
		dur: 30 + rand(i, 273) * 50,
		delay: -rand(i, 274) * 80,
		reverse: rand(i, 275) < 0.3,
		tw: 2 + rand(i, 276) * 4,
		twDelay: -rand(i, 277) * 6
	}));
</script>

<div class="abyss"></div>
<div class="swirl conic"></div>
<svg class="swirl wide" viewBox="-50 -50 100 100">
	{#each armsWide as d, i (i)}<path {d} />{/each}
</svg>
<svg class="swirl thin" viewBox="-50 -50 100 100">
	{#each armsThin as d, i (i)}<path {d} />{/each}
</svg>
<svg class="swirl runes" viewBox="-50 -50 100 100">
	<circle r="30" />
	<circle class="dash" r="27" />
</svg>
<div class="core"></div>
<div class="spark"></div>
{#each motes as m, i (i)}
	<div
		class="orbit"
		style:rotate="{m.start}deg"
		style:animation-duration="{m.dur}s"
		style:animation-delay="{m.delay}s"
		style:animation-direction={m.reverse ? 'reverse' : 'normal'}
	>
		<span
			style:--r="{m.r}cqmin"
			style:--size="{m.size}cqmin"
			style:animation-duration="{m.tw}s"
			style:animation-delay="{m.twDelay}s"
		></span>
	</div>
{/each}

<style>
	.abyss {
		inset: 0;
		background: radial-gradient(
			ellipse 80% 80% at 50% 50%,
			oklch(0.2 0.09 300),
			oklch(0.1 0.05 295) 55%,
			oklch(0.05 0.02 290)
		);
	}
	.swirl {
		left: 50%;
		top: 50%;
		width: 150cqmax;
		height: 150cqmax;
		translate: -50% -50%;
		mix-blend-mode: screen;
		animation: scene-spin linear infinite;
	}
	.conic {
		border-radius: 50%;
		background: repeating-conic-gradient(
			from 0deg,
			oklch(0.45 0.18 300 / 0.35) 0deg,
			transparent 18deg,
			oklch(0.4 0.15 280 / 0.25) 36deg,
			transparent 54deg,
			oklch(0.45 0.18 300 / 0.35) 72deg
		);
		/* An alpha mask, not a colour: only its opacity counts. */
		mask-image: radial-gradient(circle, black 4%, transparent 45%);
		filter: blur(2cqmin);
		animation-duration: 90s;
	}
	.wide,
	.thin {
		width: 110cqmin;
		height: 110cqmin;
		fill: none;
		stroke-linecap: round;
	}
	.wide {
		stroke: oklch(0.55 0.2 300 / 0.55);
		stroke-width: 4;
		filter: blur(1.6cqmin);
		animation-duration: 55s;
	}
	.thin {
		stroke: oklch(0.75 0.13 230 / 0.5);
		stroke-width: 1.2;
		filter: blur(0.5cqmin);
		animation-duration: 75s;
		animation-direction: reverse;
	}
	.runes {
		width: 90cqmin;
		height: 90cqmin;
		fill: none;
		stroke: oklch(0.7 0.12 300 / 0.25);
		stroke-width: 0.3;
		mix-blend-mode: normal;
		animation-duration: 140s;
	}
	.dash {
		stroke-width: 1.2;
		stroke-dasharray: 0.6 2.4 3 2.4;
	}
	.core {
		left: 50%;
		top: 50%;
		width: 50cqmin;
		height: 50cqmin;
		translate: -50% -50%;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			oklch(0.85 0.12 300 / 0.7),
			oklch(0.6 0.2 300 / 0.3) 25%,
			transparent 65%
		);
		animation: breathe 5s ease-in-out infinite alternate;
	}
	.spark {
		left: 50%;
		top: 50%;
		width: 6cqmin;
		height: 6cqmin;
		translate: -50% -50%;
		border-radius: 50%;
		background: radial-gradient(circle, oklch(0.98 0.04 300), transparent 70%);
		animation: scene-pulse 2.2s ease-in-out infinite alternate;
	}
	.orbit {
		left: 50%;
		top: 50%;
		width: 0;
		height: 0;
		animation: scene-spin linear infinite;
	}
	.orbit span {
		position: absolute;
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
		transform: translateX(var(--r));
		background: radial-gradient(circle, oklch(0.92 0.08 290), oklch(0.7 0.15 290 / 0) 70%);
		animation: scene-twinkle ease-in-out infinite alternate;
	}
	@keyframes breathe {
		from {
			transform: scale(0.9);
			opacity: 0.7;
		}
		to {
			transform: scale(1.1);
			opacity: 1;
		}
	}
</style>

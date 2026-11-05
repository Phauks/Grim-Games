<script lang="ts">
	// Runs the clock for the scene showing, paces its frames and keeps the frame rate up by
	// trading the smoky layer's sharpness (never the sparks'). fps 'screen' draws once per
	// screen refresh; '30' caps it. Held still or paused, it draws only when a setting changes.
	import { useTask, useThrelte } from '@threlte/core';
	import type { MovingId, MovingMotion, MovingParams } from '#lib/core/backgrounds/moving.ts';
	import { provideClock } from './gl/clock.ts';
	import Vortex from './scenes/Vortex.svelte';
	import Fire from './scenes/Fire.svelte';
	import Rain from './scenes/Rain.svelte';
	import Stars from './scenes/Stars.svelte';
	import YinYang from './scenes/YinYang.svelte';

	interface Props {
		id: MovingId;
		params: MovingParams;
		fps: MovingMotion['fps'];
		speed: number;
		still: boolean;
		paused: boolean;
	}
	let { id, params, fps, speed, still, paused }: Props = $props();
	const SCENES = { vortex: Vortex, fire: Fire, rain: Rain, stars: Stars, yinyang: YinYang };
	const Scene = $derived(SCENES[id]);

	const clock = provideClock();
	const { invalidate } = useThrelte();
	const LOOP = 3600;
	const SCALES = [1, 0.85, 0.7, 0.55, 0.45, 0.35];
	const RATES = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240];

	// Screen refresh, read from the shortest gaps between animation frames: the browser only
	// hands out frames on refresh, so even a slow frame lands on a multiple of it. It is read
	// again every 60 frames and only changes when two readings in a row agree.
	const gaps: number[] = [];
	let lastNow = 0;
	let refresh = 60;
	let candidate = 60;
	let sinceRead = 0;
	function readRefresh(now: number) {
		if (lastNow) {
			gaps.push(now - lastNow);
			if (gaps.length > 240) gaps.shift();
		}
		lastNow = now;
		if (gaps.length < 60 || ++sinceRead < 60) return;
		sinceRead = 0;
		const sorted = [...gaps].sort((a, b) => a - b);
		const hz = 1000 / sorted[Math.floor(sorted.length * 0.25)];
		const snapped = RATES.reduce((a, b) => (Math.abs(b - hz) < Math.abs(a - hz) ? b : a));
		if (snapped === candidate) refresh = snapped;
		candidate = snapped;
	}

	let drawn = 0;
	let windowStart = 0;
	let level = 0;
	let goodWindows = 0;
	let accum = 0;
	useTask((delta) => {
		if (still || paused) {
			lastNow = 0;
			windowStart = 0;
			return;
		}
		const now = performance.now();
		readRefresh(now);
		const target = fps === 'screen' ? refresh : Math.min(Number(fps), refresh);
		const period = 1 / target;
		accum += delta;
		// A small slack keeps a 30 cap at 30 on a 60 Hz screen.
		if (fps !== 'screen' && accum < period * 0.92) return;
		const step = Math.min(fps === 'screen' ? delta : accum, 0.1) * speed;
		accum = fps === 'screen' ? 0 : Math.max(0, Math.min(accum - period, period));
		clock.t = (clock.t + step) % LOOP;
		drawn++;
		invalidate();
		// Once a second, judge whether the target was met, and adjust the smoky layer.
		if (!windowStart) windowStart = now;
		if (now - windowStart < 1000) return;
		const measured = (drawn * 1000) / (now - windowStart);
		if (measured < target * 0.9 && level < SCALES.length - 1) {
			level++;
			goodWindows = 0;
		} else if (measured >= target * 0.97) {
			if (++goodWindows >= 4 && level > 0) {
				level--;
				goodWindows = 0;
			}
		} else goodWindows = 0;
		clock.bgScale = SCALES[level];
		drawn = 0;
		windowStart = now;
	});
	$effect(() => {
		JSON.stringify(params);
		void still;
		void paused;
		invalidate();
	});
</script>

{#key id}
	<Scene {params} />
{/key}

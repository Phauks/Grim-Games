<script lang="ts">
	import { PAD_ASPECT, type ScratchStroke } from '#lib/core/scratch/scratch.ts';
	import { drawAll, inkColours } from './render.ts';

	interface Props {
		strokes: readonly ScratchStroke[];
	}

	let { strokes }: Props = $props();
	let canvas: HTMLCanvasElement;
	let width = $state(0);

	$effect(() => {
		const observer = new ResizeObserver(([entry]) => (width = entry.contentRect.width));
		observer.observe(canvas);
		return () => observer.disconnect();
	});

	// A small copy of the pad; its size comes from CSS, so it never moves the layout.
	$effect(() => {
		if (!width) return;
		const ratio = window.devicePixelRatio || 1;
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(width * PAD_ASPECT * ratio);
		const ctx = canvas.getContext('2d');
		if (ctx) drawAll(ctx, strokes, canvas.width, inkColours(canvas));
	});
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
	canvas {
		display: block;
		width: 100%;
		aspect-ratio: 3 / 4;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
	}
</style>

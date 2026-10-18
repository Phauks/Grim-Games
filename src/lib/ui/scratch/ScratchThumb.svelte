<script lang="ts">
	import { previewFit } from '#lib/core/scratch/scratch.ts';
	import { drawStroke, inkColours } from './render.ts';
	import type { ScratchPadState } from './scratch-store.svelte.ts';

	interface Props {
		pad: ScratchPadState;
	}

	let { pad }: Props = $props();
	let canvas: HTMLCanvasElement;
	let width = $state(0);
	let height = $state(0);

	$effect(() => {
		const observer = new ResizeObserver(([entry]) => {
			width = Math.floor(entry.contentRect.width);
			height = Math.floor(entry.contentRect.height);
		});
		observer.observe(canvas);
		return () => observer.disconnect();
	});

	// The whole drawing, as large as fits and centred, on its own paper (Trevor, 2026-10-18:
	// no empty space beside it); redrawn when it or the paper changes.
	$effect(() => {
		const strokes = pad.strokes;
		void pad.paper;
		if (!width || !height) return;
		const ratio = window.devicePixelRatio || 1;
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(height * ratio);
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const { scale, x, y } = previewFit(strokes, canvas.width, canvas.height);
		const colours = inkColours(canvas);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.save();
		ctx.translate(x, y);
		for (const stroke of strokes) drawStroke(ctx, stroke, scale, colours);
		ctx.restore();
	});
</script>

<canvas bind:this={canvas} class="thumb" data-scratch-paper={pad.paper} aria-hidden="true"></canvas>

<style>
	.thumb {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: var(--radius-sm);
		background: var(--scratch-paper);
	}
</style>

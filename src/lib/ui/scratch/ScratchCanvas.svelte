<script lang="ts">
	import { untrack } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		addPoint,
		PAD_ASPECT,
		type ScratchColour,
		type ScratchStroke,
		type ScratchTool
	} from '#lib/core/scratch/scratch.ts';
	import { drawAll, drawSegment, finish, inkColours, type InkColours } from './render.ts';
	import type { ScratchPadState } from './scratch-store.svelte.ts';

	interface Props {
		pad: ScratchPadState;
		tool: ScratchTool;
		colour: ScratchColour;
	}

	let { pad, tool, colour }: Props = $props();

	let frame: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	/** The page's size in CSS pixels: the largest portrait page that fits the frame. */
	let width = $state(0);
	let ctx: CanvasRenderingContext2D | null = null;
	let colours: InkColours;
	/** Canvas pixels per pad width (CSS width x device pixel ratio). */
	let scale = 0;
	/** The strokes already on the canvas, so a finished live stroke needs no redraw. */
	let drawn: readonly ScratchStroke[] = [];
	let live: { stroke: ScratchStroke; pointerId: number; pointerType: string } | undefined;
	/** Once a pen has touched the pad, fingers and palms no longer draw (palm rejection). */
	let penSeen = false;

	$effect(() => {
		const observer = new ResizeObserver(([entry]) => {
			const { width: w, height: h } = entry.contentRect;
			width = Math.max(0, Math.floor(Math.min(w, h / PAD_ASPECT)));
		});
		observer.observe(frame);
		return () => observer.disconnect();
	});

	// A touch on the pad is drawing, never a browser gesture. Without this, a quick stroke can
	// start a fling, and the browser swallows the next tap (on a colour, say) to stop it.
	// Svelte's touch handlers are passive, so this one is added by hand.
	$effect(() => {
		const stop = (event: TouchEvent) => event.cancelable && event.preventDefault();
		canvas.addEventListener('touchstart', stop, { passive: false });
		return () => canvas.removeEventListener('touchstart', stop);
	});

	function redraw() {
		if (!ctx) return;
		colours = inkColours(canvas);
		drawAll(ctx, pad.strokes, scale, colours);
		drawn = pad.strokes;
	}

	// Size the backing store for sharp lines, then draw everything.
	$effect(() => {
		if (!width) return;
		const ratio = window.devicePixelRatio || 1;
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(width * PAD_ASPECT * ratio);
		scale = canvas.width;
		ctx = canvas.getContext('2d');
		untrack(redraw);
	});

	// Undo, redo, clear or a stroke from elsewhere: redraw, unless the only change is the
	// stroke just drawn live (already on the canvas).
	$effect(() => {
		const strokes = pad.strokes;
		if (!ctx) return;
		const justDrawn = committed;
		committed = undefined;
		const appendedLive =
			justDrawn !== undefined &&
			strokes.length === drawn.length + 1 &&
			strokes.at(-1) === justDrawn &&
			strokes.slice(0, -1).every((s, i) => s === drawn[i]);
		if (appendedLive) drawn = strokes;
		else redraw();
	});

	/** The live stroke just handed to the pad, drawn on the canvas but not yet in `drawn`. */
	let committed: ScratchStroke | undefined;

	function point(event: PointerEvent): [number, number, number] {
		const rect = canvas.getBoundingClientRect();
		const pressure = event.pointerType === 'pen' ? event.pressure : 0.5;
		return [
			(event.clientX - rect.left) / rect.width,
			(event.clientY - rect.top) / rect.width,
			pressure
		];
	}

	function discardLive() {
		live = undefined;
		redraw();
	}

	function down(event: PointerEvent) {
		if (!ctx) return;
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		if (event.pointerType === 'pen') {
			penSeen = true;
			// A palm that landed first started a stroke: drop it and draw with the pen.
			if (live && live.pointerType !== 'pen') discardLive();
		}
		if (live) return; // A second finger or a palm while drawing.
		if (event.pointerType === 'touch' && penSeen) return;
		event.preventDefault();
		// Keeps the stroke going when the pen leaves the pad; a stale pointer id can throw.
		try {
			canvas.setPointerCapture(event.pointerId);
		} catch {
			/* drawing still works inside the pad */
		}
		const stroke: ScratchStroke = { tool, colour, points: [] };
		addPoint(stroke.points, ...point(event));
		live = { stroke, pointerId: event.pointerId, pointerType: event.pointerType };
		drawSegment(ctx, stroke, 0, scale, colours);
	}

	function move(event: PointerEvent) {
		if (!ctx || !live || event.pointerId !== live.pointerId) return;
		const { stroke } = live;
		// Coalesced events carry every sample since the last frame, for smoother lines.
		for (const sample of event.getCoalescedEvents?.() ?? [event]) {
			if (addPoint(stroke.points, ...point(sample)))
				drawSegment(ctx, stroke, stroke.points.length / 3 - 1, scale, colours);
		}
	}

	function up(event: PointerEvent) {
		if (!ctx || !live || event.pointerId !== live.pointerId) return;
		const { stroke } = live;
		live = undefined;
		finish(ctx, stroke, scale, colours);
		committed = stroke;
		pad.add(stroke);
	}

	function cancel(event: PointerEvent) {
		if (live && event.pointerId === live.pointerId) discardLive();
	}
</script>

<div class="frame" bind:this={frame}>
	<canvas
		bind:this={canvas}
		aria-label={t('scratch.drawing')}
		data-testid="scratch-canvas"
		style:width="{width}px"
		style:height="{width * PAD_ASPECT}px"
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={cancel}
		onlostpointercapture={cancel}
		oncontextmenu={(event) => event.preventDefault()}
	></canvas>
</div>

<style>
	.frame {
		display: grid;
		place-items: center;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}
	canvas {
		display: block;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		/* The pad owns every touch: no scrolling, zooming or text selection while writing. */
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
		cursor: crosshair;
	}
</style>

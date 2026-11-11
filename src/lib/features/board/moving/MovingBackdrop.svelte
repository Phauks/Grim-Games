<script lang="ts">
	import type { Component, ComponentProps } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import {
		MOVING_BACKGROUNDS,
		movingRun,
		type MovingChoice
	} from '#lib/core/backgrounds/moving.ts';
	import type MovingCanvasType from './MovingCanvas.svelte';
	import { movingMotion } from './motion.svelte.ts';
	import { overlayOpen, watchOverlays } from './overlay-open.svelte.ts';

	/**
	 * A moving background (M43), on the board or in a preview. three.js is only loaded once
	 * one is shown. Until it is, and on a device without WebGL, a still blend of the scene's
	 * own colours stands in. It holds still when this device says so (movingRun), and stops
	 * while the app is hidden or, behind the board, while a dialog covers it.
	 */
	interface Props {
		choice: MovingChoice;
		/** Fills its positioned parent (a preview) instead of the whole screen. */
		contained?: boolean;
	}
	let { choice, contained = false }: Props = $props();

	const run = $derived(movingRun(choice, movingMotion.current, prefersReducedMotion.current));
	/** A still stand-in: the scene's first two colours, top to bottom. */
	const fallback = $derived.by(() => {
		const colours = MOVING_BACKGROUNDS[choice.id].params
			.filter((p) => p.type === 'colour')
			.map((p) => String(choice.params[p.id]));
		return `linear-gradient(${colours[0]}, ${colours[1] ?? colours[0]})`;
	});

	let hidden = $state(typeof document !== 'undefined' && document.hidden);
	$effect(() => {
		const seen = () => (hidden = document.hidden);
		document.addEventListener('visibilitychange', seen);
		return () => document.removeEventListener('visibilitychange', seen);
	});
	$effect(() => (contained ? undefined : watchOverlays()));
	const paused = $derived(hidden || (!contained && overlayOpen()));

	let MovingCanvas = $state.raw<Component<ComponentProps<typeof MovingCanvasType>>>();
	let failed = $state(false);
	$effect(() => {
		if (MovingCanvas || failed) return;
		if (!hasWebGL()) {
			failed = true;
			return;
		}
		import('./MovingCanvas.svelte')
			.then((module) => (MovingCanvas = module.default))
			.catch(() => (failed = true));
	});

	function hasWebGL(): boolean {
		try {
			const canvas = document.createElement('canvas');
			return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
		} catch {
			return false;
		}
	}
</script>

<div
	class="moving"
	class:contained
	data-testid={contained ? 'preview-background' : 'board-background'}
	data-moving={choice.id}
	data-still={run.still || paused ? '' : undefined}
	style:background={fallback}
	aria-hidden="true"
>
	{#if MovingCanvas}
		<MovingCanvas
			id={choice.id}
			params={run.params}
			fps={movingMotion.current.fps}
			speed={run.speed}
			still={run.still}
			{paused}
		/>
	{/if}
</div>

<style>
	.moving {
		position: fixed;
		inset: 0;
		z-index: var(--z-backdrop);
		overflow: hidden;
		pointer-events: none;
	}
	.contained {
		position: absolute;
	}
	.moving :global(canvas) {
		display: block;
	}
</style>

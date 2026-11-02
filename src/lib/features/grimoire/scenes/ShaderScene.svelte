<script lang="ts">
	import { boardCovered } from './board-covered.ts';
	import { SHADERS, type ShaderSceneId } from './shaders.ts';
	import { shaderRenderer } from './webgl.ts';

	/**
	 * A shader scene (moving backgrounds, plan L113): its fragment shader drawn at half size and
	 * at most 30 frames a second. It stops while the page is hidden, and on the board while a
	 * sheet or dialog covers it; still, it draws one frame and stops. Without WebGL it draws
	 * nothing, and the preset's still frame behind it shows.
	 */
	interface Props {
		id: ShaderSceneId;
		still: boolean;
		/** In the Settings preview, which a dialog never covers. */
		contained: boolean;
	}

	let { id, still, contained }: Props = $props();
	let canvas = $state<HTMLCanvasElement>();
	let failed = $state(false);

	const FRAME_MS = 1000 / 30;
	/** The moment a still scene shows: some way in, so every layer has come on screen. */
	const STILL_SECONDS = 4;

	// Read by the running loop without building the shader again when they change.
	const live = { still: false, restart: () => {} };
	$effect(() => {
		live.still = still;
		live.restart();
	});

	$effect(() => {
		const element = canvas;
		if (!element) return;
		const renderer = shaderRenderer(element, SHADERS[id]);
		failed = !renderer;
		if (!renderer) return;
		let frame = 0;
		let last = 0;
		const loop = (now: number) => {
			frame = requestAnimationFrame(loop);
			if (now - last < FRAME_MS || (!contained && boardCovered())) return;
			last = now;
			renderer.draw(now / 1000);
		};
		const restart = () => {
			cancelAnimationFrame(frame);
			if (document.hidden) return;
			if (live.still) renderer.draw(STILL_SECONDS);
			else frame = requestAnimationFrame(loop);
		};
		// A still frame is drawn again at a new size; a moving one sizes itself each frame.
		const resized = new ResizeObserver(() => {
			if (live.still) renderer.draw(STILL_SECONDS);
		});
		resized.observe(element);
		document.addEventListener('visibilitychange', restart);
		live.restart = restart;
		restart();
		return () => {
			live.restart = () => {};
			cancelAnimationFrame(frame);
			resized.disconnect();
			document.removeEventListener('visibilitychange', restart);
			renderer.dispose();
		};
	});
</script>

<canvas bind:this={canvas} class:failed></canvas>

<style>
	canvas {
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.failed {
		display: none;
	}
</style>

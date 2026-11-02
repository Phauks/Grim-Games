<script lang="ts">
	import { CSS_SCENES, type CssSceneId } from './css-scenes.ts';
	import type { SceneKind } from './scene-presets.ts';
	import ShaderScene from './ShaderScene.svelte';
	import type { ShaderSceneId } from './shaders.ts';

	/**
	 * A moving background's moving layer (plan L113), over its preset's still frame and under
	 * the vignette: a CSS scene or a shader scene, dimmed so seat names and labels stay
	 * readable. Still (the Moving backgrounds switch off, or the device asks for less motion),
	 * a CSS scene stops where it is and a shader scene draws one frame. On the board, a sheet
	 * or dialog over it stops it too; the Settings preview (`contained`) never stops for that.
	 */
	interface Props {
		id: CssSceneId | ShaderSceneId;
		kind: SceneKind;
		still: boolean;
		/** Fills its positioned parent (the preview) instead of the whole screen. */
		contained: boolean;
	}

	let { id, kind, still, contained }: Props = $props();
</script>

<div
	class="layer"
	class:still
	class:contained
	data-testid={contained ? 'preview-scene' : 'board-scene'}
	data-scene={id}
	data-engine={kind}
	data-still={still}
	aria-hidden="true"
>
	{#if kind === 'shader'}
		<!-- A canvas whose context was lost can't get another: a new scene, a new canvas. -->
		{#key id}<ShaderScene id={id as ShaderSceneId} {still} {contained} />{/key}
	{:else}
		{@const Scene = CSS_SCENES[id as CssSceneId]}
		<Scene />
	{/if}
</div>

<style>
	.layer {
		position: fixed;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		pointer-events: none;
		/* Dimmed like an image, so seat names and labels stay readable. */
		filter: brightness(0.6) saturate(0.95);
		/* Scenes size their pieces by this box (cq units), the screen or the preview. */
		container-type: size;
		contain: strict;
	}
	.contained {
		position: absolute;
	}
	.layer > :global(*) {
		position: absolute;
	}
	.layer :global(svg) {
		overflow: visible;
	}
	/* Still: every piece rests where it is. */
	.still :global(*),
	.still :global(*)::before,
	.still :global(*)::after {
		animation-play-state: paused !important;
	}
	/* A sheet or dialog over the board blurs it (board-cover.ts): the scene rests until it
	   closes. The same test as board-covered.ts, for the shader scenes. */
	:global(:root[data-board-shown]:has([data-part='backdrop'][data-state='open']))
		.layer:not(.contained)
		:global(*),
	:global(:root[data-board-shown]:has([data-part='backdrop'][data-state='open']))
		.layer:not(.contained)
		:global(*)::before,
	:global(:root[data-board-shown]:has([data-part='backdrop'][data-state='open']))
		.layer:not(.contained)
		:global(*)::after {
		animation-play-state: paused !important;
	}
	/* The operating system's Reduce motion wins, whatever the switch. */
	@media (prefers-reduced-motion: reduce) {
		.layer :global(*),
		.layer :global(*)::before,
		.layer :global(*)::after {
			animation-play-state: paused !important;
		}
	}

	/* Moves the CSS scenes share. */
	@keyframes -global-scene-twinkle {
		from {
			opacity: 0.12;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes -global-scene-pulse {
		from {
			opacity: 0.6;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes -global-scene-spin {
		to {
			transform: rotate(360deg);
		}
	}
	/* One tile of a 300% wide repeating layer slides past: a seamless loop. */
	@keyframes -global-scene-loopx {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(-33.3333%);
		}
	}
</style>

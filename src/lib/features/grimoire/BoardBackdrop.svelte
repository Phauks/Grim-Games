<script lang="ts">
	import type { MovingChoice } from '#lib/core/backgrounds/moving.ts';
	import { STILL_BACKGROUNDS, stillCss, type StillChoice } from '#lib/core/backgrounds/still.ts';
	import MovingBackdrop from './moving/MovingBackdrop.svelte';

	/**
	 * The board's background and vignette, on the board behind everything and in the Board
	 * settings preview (Trevor, 2026-10-20: changes show without leaving Settings).
	 */
	interface Props {
		/** An image background: the device's image or the script's link. */
		url?: string;
		/** A still background (M72), when there is no image. */
		preset?: StillChoice;
		/** An animated background (M43), when there is no image or still one. */
		moving?: MovingChoice;
		/** The vignette's strength, or undefined while it is off. */
		vignette?: number;
		/** Fills its positioned parent (the preview) instead of the whole screen. */
		contained?: boolean;
	}

	let { url, preset, moving, vignette, contained = false }: Props = $props();
</script>

<!-- The whole screen, under the toolbar and the safe areas too (Trevor, 2026-10-18). -->
{#if url}
	<div
		class="backdrop"
		class:contained
		data-testid={contained ? 'preview-background' : 'board-background'}
		style:background-image={`url("${url}")`}
	></div>
{:else if preset}
	<div
		class="backdrop preset"
		class:contained
		data-testid={contained ? 'preview-background' : 'board-background'}
		data-preset={preset.id}
		style:background={stillCss(preset)}
		style:--dim={STILL_BACKGROUNDS[preset.id].dim}
	></div>
{:else if moving}
	<MovingBackdrop choice={moving} {contained} />
{/if}
<!-- The vignette darkens the background towards the screen's edges, on every background
     (Trevor, 2026-10-17: its own switch and strength; 2026-10-18: noticeable, and over the
     whole screen like the background, not just the board). -->
{#if vignette !== undefined}
	<div
		class="vignette"
		class:contained
		data-testid={contained ? 'preview-vignette' : 'vignette'}
		style:--vignette={vignette}
		aria-hidden="true"
	></div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-backdrop);
		background: center / cover no-repeat;
		filter: brightness(0.45) saturate(0.85);
		pointer-events: none;
	}
	/* Still backgrounds are drawn for the board already: only dimmed a little, and light
	   parchment more, so it never washes out the seat names. */
	.backdrop.preset {
		filter: brightness(var(--dim));
	}
	/* The vignette (Trevor, 2026-10-17: its own switch and strength), on every background. */
	.vignette {
		position: fixed;
		inset: 0;
		z-index: var(--z-backdrop);
		/* Clear in the middle, darkening to the strength at the corners. */
		/* The two shades are darkness, not theme colours. */
		--vignette-mid: rgb(0 0 0 / calc(var(--vignette) * 0.6)); /* colour-ok: shadow */
		--vignette-edge: rgb(0 0 0 / var(--vignette)); /* colour-ok: shadow */
		background: radial-gradient(
			ellipse 75% 75% at center,
			transparent 40%,
			var(--vignette-mid) 75%,
			var(--vignette-edge) 100%
		);
		pointer-events: none;
	}
	/* Under the preview's seats: the preview isolates its own stacking. */
	.contained {
		position: absolute;
	}
</style>

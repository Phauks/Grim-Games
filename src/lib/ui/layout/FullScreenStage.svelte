<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fullScreenPart } from '#lib/ui/full-screen.svelte.ts';
	import FullScreenButton from '#lib/ui/primitives/FullScreenButton.svelte';

	/**
	 * A part of the page that can fill the screen, with Full screen in its own top right corner
	 * (Trevor, 2026-10-26: "supposed to be in the town square, and makes it so the townsquare
	 * takes up the whole screen"; 2026-10-27: the player screen's Grim, "same thing as town
	 * square"). It fills the screen over the app but under every dialog and sheet, so a seat's
	 * sheet still opens over it; the browser's own full screen hides its bars where it can.
	 */
	interface Props {
		children: Snippet;
		/**
		 * More of the corner, before Full screen; told whether the stage fills the screen. Each
		 * button sits in a `corner-button` span for the backing that reads over the board.
		 */
		corner?: Snippet<[boolean]>;
		testid?: string;
		/**
		 * How far the corner reaches in from the stage's right edge and down from its top,
		 * its gutters included, for a board that keeps its seats clear of it. Full screen
		 * steps the corner down past the camera, so its own height alone falls short (Trevor's
		 * Pixel, 2026-11-10: the buttons over the top seat and its reminder).
		 */
		cornerWidth?: number;
		cornerHeight?: number;
	}

	let {
		children,
		corner,
		testid,
		// eslint-disable-next-line no-useless-assignment -- bindable: the board reads it
		cornerWidth = $bindable(0),
		// eslint-disable-next-line no-useless-assignment -- bindable: the board reads it
		cornerHeight = $bindable(0)
	}: Props = $props();

	let stage = $state<HTMLDivElement>();
	let cornerBox = $state<HTMLDivElement>();
	function measure() {
		if (!cornerBox || !stage) return;
		cornerWidth = stage.clientWidth - cornerBox.offsetLeft;
		cornerHeight = cornerBox.offsetTop + cornerBox.offsetHeight;
	}
	$effect(() => {
		if (!cornerBox || !stage) return;
		const sizes = new ResizeObserver(measure);
		sizes.observe(cornerBox);
		sizes.observe(stage);
		return () => sizes.disconnect();
	});
	const filled = $derived(!!stage && fullScreenPart.current === stage);
	// Gone from the page, it fills nothing.
	$effect(() => () => {
		if (stage && fullScreenPart.current === stage) fullScreenPart.current = undefined;
	});
	// Filling the screen moves the corner down past the camera without resizing it.
	$effect(() => {
		void filled;
		measure();
	});
</script>

<div class="stage" bind:this={stage} data-filled={filled ? '' : undefined} data-testid={testid}>
	{@render children()}
	{#if stage}<div class="corner" data-testid="full-screen-corner" bind:this={cornerBox}>
			{@render corner?.(filled)}
			<span class="corner-button"><FullScreenButton target={stage} /></span>
		</div>{/if}
</div>

<style>
	.stage {
		position: relative;
	}
	/* Over the app, the status bar's strip included (Trevor's Pixel, 2026-10-27: "Unable to
	   close", the strip hid the corner), under the lowest dialog or sheet. The board runs to
	   the screen's edges, under the camera too; only its text and controls step in, by what
	   the phone reports for its camera and home bar, with a gutter for the rounded corners
	   (Trevor, 2026-10-27: a margin all round "was a bit much ... moving out text and
	   controls"). Corner text reads the same --edge-* values (BoardCorner). */
	.stage[data-filled] {
		--edge-top: var(--app-top);
		--edge-right: max(env(safe-area-inset-right), var(--space-4));
		--edge-bottom: max(env(safe-area-inset-bottom), var(--space-4));
		--edge-left: max(env(safe-area-inset-left), var(--space-4));
		position: fixed;
		inset: 0;
		z-index: calc(var(--z-raised) + 1);
		background: var(--surface);
	}
	.stage[data-filled] > :global(:not(.corner)) {
		height: 100%;
		border-radius: 0;
	}
	/* The board's corner lines are top left, so these go top right. */
	.corner {
		position: absolute;
		top: calc(var(--edge-top, 0rem) + var(--space-2));
		right: var(--edge-right, var(--space-2));
		z-index: var(--z-above);
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.corner :global(.corner-button) {
		border-radius: 50%;
		background: var(--board-bar-background);
	}
</style>

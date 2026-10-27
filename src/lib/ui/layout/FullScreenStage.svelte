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
	}

	let { children, corner, testid }: Props = $props();

	let stage = $state<HTMLDivElement>();
	const filled = $derived(!!stage && fullScreenPart.current === stage);
	// Gone from the page, it fills nothing.
	$effect(() => () => {
		if (stage && fullScreenPart.current === stage) fullScreenPart.current = undefined;
	});
</script>

<div class="stage" bind:this={stage} data-filled={filled ? '' : undefined} data-testid={testid}>
	{@render children()}
	{#if stage}<div class="corner">
			{@render corner?.(filled)}
			<span class="corner-button"><FullScreenButton target={stage} /></span>
		</div>{/if}
</div>

<style>
	.stage {
		position: relative;
	}
	/* Over the app, under the lowest dialog or sheet (their layers start at 2). */
	.stage[data-filled] {
		position: fixed;
		inset: 0;
		z-index: 1;
		background: var(--surface);
	}
	.stage[data-filled] > :global(:not(.corner)) {
		height: 100%;
		border-radius: 0;
	}
	/* The board's corner lines are top left, so these go top right. */
	.corner {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		z-index: 1;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.corner :global(.corner-button) {
		border-radius: 50%;
		background: var(--board-bar-background);
	}
</style>

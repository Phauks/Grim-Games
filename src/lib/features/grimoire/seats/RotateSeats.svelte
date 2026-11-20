<script lang="ts">
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';

	/**
	 * Seating's two rotations as one box split down the middle (Trevor, 2026-11-01), with the same
	 * edge as the buttons beside it: in the top bar on a phone, in the pane's footer beside the
	 * board.
	 */
	let { grimoire }: { grimoire: Grimoire } = $props();
</script>

<span class="rotate" role="group" aria-label="Rotate players">
	<IconButton
		icon="rotateAnticlockwise"
		label="Rotate players anticlockwise"
		onclick={() => grimoire.run({ type: 'RotateSeats', direction: 'anticlockwise' })}
	/>
	<IconButton
		icon="rotateClockwise"
		label="Rotate players clockwise"
		onclick={() => grimoire.run({ type: 'RotateSeats', direction: 'clockwise' })}
	/>
</span>

<style>
	.rotate {
		position: relative;
		display: flex;
		flex: none;
		overflow: hidden;
		border-radius: var(--button-radius);
		background: var(--surface);
	}
	/* The quiet Button's edge, drawn over the two halves: on a background their backing covered
	   an edge drawn under them (Trevor, 2026-11-06: "missing outside border"). */
	.rotate::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow: var(--button-ring);
		pointer-events: none;
	}
	.rotate :global(.icon-button) {
		border-radius: 0;
	}
	.rotate :global(.icon-button + .icon-button) {
		border-left: var(--control-border);
	}
</style>

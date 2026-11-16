<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { BesidePlacement } from './beside.ts';

	/**
	 * Something shown beside a screen's content while it is on (plan E3: the player screen's
	 * Notes beside its tabs; M86: the Storyteller's Game notes and Players beside the board,
	 * Trevor 2026-11-15: "I really like seeing the notes right next to the game grim"). `side`
	 * is a column on the right with a hairline, `under` splits `room` between the content (the
	 * top three fifths, given to it as `--panel-room`) and the pane. Each scrolls on its own.
	 * The content stays where it is as the pane comes and goes, so it keeps its scroll.
	 */
	interface Props {
		/** Where the pane goes; none shows the content alone. */
		placement: BesidePlacement | undefined;
		/** The pane's name, read out for its landmark. */
		label: string;
		/** The height the two share (a CSS length); the screen's by default. */
		room?: string;
		/** The pane's own contents; leave out while it is off. */
		pane?: Snippet;
		children: Snippet;
	}

	let { placement, label, room, pane, children }: Props = $props();
	const on = $derived(placement && pane ? placement : undefined);
</script>

<div class="beside" data-beside={on} style:--beside-room={room}>
	<div class="main">{@render children()}</div>
	{#if on && pane}
		<aside class="pane" aria-label={label} data-testid="beside-pane">{@render pane()}</aside>
	{/if}
</div>

<style>
	.beside {
		--room: var(--beside-room, 100dvh);
	}
	.beside[data-beside] {
		display: grid;
		gap: var(--space-4);
	}
	.beside[data-beside='side'] {
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 30%);
		align-items: start;
	}
	.pane {
		/* Headings pin to the top of the pane, which scrolls itself. */
		--pin-top: 0rem;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.beside[data-beside='side'] .pane {
		position: sticky;
		top: 0;
		height: var(--room);
		padding-inline-start: var(--space-3);
		border-inline-start: 1px solid var(--border); /* px-ok: a hairline, as the bar's */
	}
	.beside[data-beside='under'] {
		gap: 0;
		height: var(--room);
		grid-template-rows: 3fr 2fr;
	}
	.beside[data-beside='under'] .main {
		--panel-room: calc(0.6 * var(--room) - var(--space-2));
		--pin-top: 0rem;
		min-height: 0;
		overflow-y: auto;
	}
	.beside[data-beside='under'] .pane {
		border-top: 1px solid var(--border); /* px-ok: a hairline, as the bar's */
	}
</style>

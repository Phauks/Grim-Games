<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { historyItems } from './history.ts';
	import HistoryLine from './HistoryLine.svelte';

	/**
	 * An ended game's board steps through its History (Trevor, 2026-10-18): Previous and Next
	 * show the board just after each change, read-only. It takes the reminder bank's place,
	 * which an ended game cannot use, so the board never moves.
	 */
	interface Props {
		grimoire: Grimoire;
		/** One line above Previous and Next: the board's game over notice. */
		notice?: Snippet;
	}

	let { grimoire, notice }: Props = $props();

	const open = $derived(grimoire.open);
	const cursor = $derived(open.session.log.cursor);
	/** The last change the game kept; later (undone) entries are not part of it. */
	const last = $derived(open.savedCursor);
	const items = $derived(historyItems(open.session.log.entries, last, open.characters));
	/** Oldest first: the points Previous and Next step between (a draw and its confirmation are one). */
	const stops = $derived(items.map((i) => i.cursor).reverse());
	const item = $derived(items.find((i) => i.cursor === cursor));
	const previous = $derived(stops.findLast((c) => c < cursor));
	const next = $derived(stops.find((c) => c > cursor));
	const position = $derived(stops.filter((c) => c <= cursor).length);
</script>

{#if notice}<div class="notice">{@render notice()}</div>{/if}
<section class="strip" class:below={!!notice} aria-label="Game history" data-testid="history-strip">
	<IconButton
		icon="back"
		label="Previous change"
		disabled={previous === undefined}
		onclick={() => previous !== undefined && open.goTo(previous)}
	/>
	<p class="line" aria-live="polite">
		<span class="count">{position} of {stops.length}</span>
		{#if item}<HistoryLine parts={item.parts} characters={open.characters} />{/if}
	</p>
	<IconButton
		icon="forward"
		label="Next change"
		disabled={next === undefined}
		onclick={() => next !== undefined && open.goTo(next)}
	/>
</section>

<style>
	.notice {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(100% + var(--space-2));
		z-index: 2;
		display: flex;
		justify-content: center;
		height: var(--tap-target);
	}
	.strip.below {
		top: calc(100% + 2 * var(--space-2) + var(--tap-target));
	}
	.strip {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(100% + var(--space-2));
		z-index: 2;
		display: flex;
		align-items: center;
		gap: var(--space-1);
		height: var(--tray-h);
		box-sizing: border-box;
		padding: var(--space-1);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--board-bar-background);
	}
	/* Fixed height: a long change scrolls inside, so stepping never moves anything. */
	.line {
		flex: 1;
		min-width: 0;
		max-height: 100%;
		margin: 0;
		overflow-y: auto;
		line-height: 1.6;
		scrollbar-width: none;
	}
	.line::-webkit-scrollbar {
		display: none;
	}
	.count {
		margin-inline-end: var(--space-2);
		color: var(--on-surface-muted);
		font-size: 0.8rem;
	}
</style>

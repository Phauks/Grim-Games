<script lang="ts">
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
	}

	let { grimoire }: Props = $props();

	const open = $derived(grimoire.open);
	const cursor = $derived(open.session.log.cursor);
	/** The last change the game kept; later (undone) entries are not part of it. */
	const last = $derived(open.savedCursor);
	const items = $derived(historyItems(open.session.log.entries, last, open.characters));
	const item = $derived(items.find((i) => i.cursor === cursor));
</script>

<section class="strip" aria-label="Game history" data-testid="history-strip">
	<IconButton
		icon="back"
		label="Previous change"
		disabled={cursor <= 1}
		onclick={() => open.goTo(cursor - 1)}
	/>
	<p class="line" aria-live="polite">
		<span class="count">{cursor} of {last}</span>
		{#if item}<HistoryLine parts={item.parts} characters={open.characters} />{/if}
	</p>
	<IconButton
		icon="forward"
		label="Next change"
		disabled={cursor >= last}
		onclick={() => open.goTo(cursor + 1)}
	/>
</section>

<style>
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
		background: color-mix(in srgb, var(--surface) 85%, transparent);
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

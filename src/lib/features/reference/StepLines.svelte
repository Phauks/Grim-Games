<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Lettered a, b, c (a branch's lines), else numbered. */
		lettered?: boolean;
		/** How many lines come before this list, so its numbers carry on from theirs. */
		start?: number;
		/** The `StepLine`s. */
		children: Snippet;
	}

	let { lettered = false, start = 0, children }: Props = $props();
</script>

<!--
	The numbered lines of a night step (Trevor, 2026-11-06, the "Ledger"): TPI's text in
	`NightTextLines`, and the cards Minion info and Demon info show (`EvilInfoCards`), so every
	step's lines look and work alike.
-->
<ol class="lines" class:lettered style:counter-reset="line {start}">
	{@render children()}
</ol>

<style>
	.lines {
		margin: 0;
		padding: 0;
		list-style: none;
		font-family: var(--font-ability);
		line-height: 1.35;
	}
	.lines :global(> li) {
		counter-increment: line;
	}
	.lines :global(> li::before) {
		content: counter(line);
		color: var(--heading);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.lettered :global(> li::before) {
		content: counter(line, lower-alpha);
	}
</style>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLLiAttributes } from 'svelte/elements';

	interface Props extends HTMLLiAttributes {
		/** Drawn as done (`data-marked-row`): its card has been shown. */
		marked?: boolean;
		/** The line itself. */
		children: Snippet;
		/** After the line: its eye, and any other button. */
		end?: Snippet;
	}

	let { marked = false, children, end, ...rest }: Props = $props();
</script>

<!-- One line of a night step, inside `StepLines`: its number, the line, then its eye. -->
<li class="step-line" data-marked-row={marked ? '' : undefined} {...rest}>
	<span class="line">{@render children()}</span>
	{#if end}<span class="end">{@render end()}</span>{/if}
</li>

<style>
	.step-line {
		display: grid;
		grid-template-columns: 1.6em minmax(0, 1fr) auto;
		align-items: baseline;
		column-gap: var(--space-2);
		min-height: var(--tap-target);
		padding-block: var(--space-1);
		border-bottom: 0.0625rem solid var(--border);
	}
	.line {
		grid-column: 2;
		/* Its rows (a placed reminder's Move and delete) shrink to the step's width. */
		min-width: 0;
	}
	/* With no eye after it, the line reaches the step's end, so the eyes in its rows (Valid
	   Information) line up with the step's own (Trevor, 2026-11-19). */
	.line:last-child,
	.line:has(+ .end:empty) {
		grid-column: 2 / -1;
	}
	.end:empty {
		display: none;
	}
	.end {
		grid-column: 3;
		align-self: center;
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
</style>

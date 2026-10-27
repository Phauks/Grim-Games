<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * One of the day's counts as a filled badge, the number on top (Trevor, 2026-10-19), shared by
	 * the Storyteller's day counts and the players' Today sheet so both look the same. With
	 * `onclick` it opens how the count was worked out; without, it only shows.
	 */
	interface Props {
		kind: 'alive' | 'good' | 'evil' | 'ghost' | 'votes';
		/** The count in words: its accessible name and tooltip. */
		label: string;
		testid?: string;
		onclick?: () => void;
		children: Snippet;
	}

	let { kind, label, testid, onclick, children }: Props = $props();
</script>

{#if onclick}
	<button
		type="button"
		class="badge {kind}"
		data-testid={testid}
		aria-label={label}
		title={label}
		{onclick}>{@render children()}</button
	>
{:else}
	<span class="badge {kind}" data-testid={testid} role="img" aria-label={label} title={label}
		>{@render children()}</span
	>
{/if}

<style>
	.badge {
		display: inline-flex;
		flex: 1 1 0;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		box-sizing: border-box;
		min-width: 0;
		min-height: var(--tap-target);
		padding: 0 var(--space-1);
		border: 1px solid var(--surface-selected);
		border-radius: var(--radius-full);
		background: var(--surface-selected);
		color: var(--on-surface);
		font-family: inherit;
		font-size: clamp(0.75rem, 5cqi, 1rem);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	button.badge {
		cursor: pointer;
	}
	/* The team counts in their team's colour. --on-good reads on both teams (badge-colours.test.ts). */
	.badge.good {
		border-color: var(--good);
		background: var(--good);
		color: var(--on-good);
	}
	.badge.evil {
		border-color: var(--evil);
		background: var(--evil);
		color: var(--on-good);
	}
	/* Each count in its own colour (Trevor, 2026-10-20: L21). The living are both teams, so
	   half blue, half red; --on-good reads on both halves. */
	.badge.alive {
		border-color: transparent;
		background: var(--evil) linear-gradient(to right, var(--good) 50%, var(--evil) 50%) border-box;
		color: var(--on-good);
	}
	/* Ghost votes left in an unused ghost vote's colours (DeadBadge.svelte), inverted: a dark
	   ghost on white (Trevor, 2026-10-22). */
	.badge.ghost {
		border-color: var(--ghost-vote-rim);
		background: var(--ghost-vote);
		color: var(--ghost-vote-badge);
	}
	/* Votes needed in gold; --heading on --surface is a theme contrast pair. */
	.badge.votes {
		border-color: var(--heading);
		background: var(--heading);
		color: var(--surface);
		font-family: var(--font-control);
	}
</style>

<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * One choice in a vote on a phone: the spectators' vote (Specters) and the vote on the
	 * next script share it. `mark` is the seat number, or a ranked choice's place; `aside` is
	 * the option's count, when the Storyteller lets players see it (Trevor, 2026-10-26).
	 */
	interface Props {
		mark?: string | number;
		aside?: string;
		pressed: boolean;
		disabled?: boolean;
		onclick: () => void;
		children: Snippet;
	}

	let { mark = '', aside, pressed, disabled = false, onclick, children }: Props = $props();
</script>

<button type="button" class="choice" aria-pressed={pressed} {disabled} {onclick}>
	<span class="mark">{mark}</span>
	<span class="label"
		>{@render children()}{#if aside}<span class="aside" data-testid="vote-count">{aside}</span
			>{/if}</span
	>
</button>

<style>
	.choice {
		display: grid;
		grid-template-columns: 2.5em minmax(0, 1fr);
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: inherit;
		font: inherit;
		text-align: start;
		touch-action: manipulation;
	}
	.mark {
		font-variant-numeric: tabular-nums;
	}
	/* A long name wraps rather than hiding behind the row's buttons on a phone. */
	.label {
		padding-block: var(--space-1);
		overflow-wrap: anywhere;
	}
	/* The count on its own line under the name, so it never squeezes the name out. */
	.aside {
		display: block;
		color: var(--on-surface-muted);
		font-size: 0.9em;
		font-variant-numeric: tabular-nums;
	}
	.choice[aria-pressed='true'] {
		border-color: var(--accent);
		background: var(--surface-selected);
	}
</style>

<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * One choice in a vote on a phone: the spectators' vote (Specters) and the vote on the
	 * next script share it. `mark` is the seat number, or a ranked choice's place.
	 */
	interface Props {
		mark?: string | number;
		pressed: boolean;
		disabled?: boolean;
		onclick: () => void;
		children: Snippet;
	}

	let { mark = '', pressed, disabled = false, onclick, children }: Props = $props();
</script>

<button type="button" class="choice" aria-pressed={pressed} {disabled} {onclick}>
	<span class="mark">{mark}</span>
	<span class="label">{@render children()}</span>
</button>

<style>
	.choice {
		display: grid;
		grid-template-columns: 2.5em 1fr;
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
	.label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.choice[aria-pressed='true'] {
		border-color: var(--accent);
		background: var(--surface-selected);
	}
</style>

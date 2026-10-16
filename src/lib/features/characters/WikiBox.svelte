<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** The box's numbered label, e.g. "Example 2" or "Tip 3". */
		label: string;
		children: Snippet;
	}

	let { label, children }: Props = $props();
</script>

<!-- One numbered item from a wiki section (an example, a tip): every kind looks the same. -->
<section class="box" aria-label={label}>
	<h4>{label}</h4>
	{@render children()}
</section>

<style>
	.box {
		margin: 0 0 var(--space-3);
		padding: var(--space-3);
		border: var(--card-border);
		border-inline-start: calc(0.25 * var(--u)) solid var(--heading);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}
	h4 {
		margin: 0 0 var(--space-1);
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
	.box :global(p) {
		margin: 0;
	}
</style>

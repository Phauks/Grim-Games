<!--
	What a change does, before it is confirmed: label and value pairs such as Now and Becomes
	(Trevor, 2026-10-16: every change of state says what it is now and what it becomes).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { testid, children }: { testid?: string; children: Snippet } = $props();
</script>

<dl class="change" data-testid={testid}>{@render children()}</dl>

<style>
	.change {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
		align-items: center;
		margin: 0 0 var(--space-2);
	}
	.change :global(dt) {
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
	.change :global(dd) {
		margin: 0;
	}
</style>

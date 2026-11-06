<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<!--
  A character's setup note ("+2 Outsiders"), on its own line under the ability with a bar of
  the character type's colour and in italics, never a symbol (Trevor, 2026-11-06: option H in
  italics). A span drawn as a block so it can sit inside the ability's own span or paragraph.
-->
<span class="setup-note" data-testid="setup-note">{@render children()}</span>

<style>
	.setup-note {
		display: block;
		margin-top: var(--space-1);
		padding-inline-start: var(--space-2);
		border-inline-start: 0.2em solid var(--team, var(--on-surface-muted));
		font-size: 0.92em;
		font-style: italic;
	}
</style>

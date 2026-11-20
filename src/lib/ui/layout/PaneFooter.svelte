<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * The footer of a view in the Storyteller's pane: what decides or ends the view (Cancel and
	 * Confirm, Done), under a dividing line at the pane's foot, so only what can change scrolls
	 * above it (Trevor, 2026-11-19: "the confirm and cancel button at the bottom should be a
	 * footer ... so we segment changeable stuff inside the middle"). One for every view.
	 */
	let { children }: { children: Snippet } = $props();
</script>

<div class="pane-footer" data-testid="pane-footer">{@render children()}</div>

<style>
	.pane-footer {
		flex: none;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--pane-gutter, 0rem);
		border-top: 1px solid var(--border);
		/* ModalActions sits flush in it, with no sticky backing of its own. */
		--modal-actions-inset: 0rem;
		--modal-actions-background: transparent;
	}
	.pane-footer :global(.modal-actions) {
		position: static;
		padding-top: 0;
		box-shadow: none;
	}
</style>

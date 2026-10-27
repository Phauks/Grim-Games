<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Sections one under another (Collapsibles, PageSections), with a line between each two
	 * (Trevor, 2026-10-27: "There should always be a delineator between anything that has a
	 * carrot menu"). The line and the spacing live here, not in each screen, so every stack of
	 * sections looks the same; `e2e/caret-dividers.e2e.ts` checks every drawn caret has one.
	 */
	interface Props {
		/** A line above the first one too, where a heading or a field sits right above it. */
		edge?: boolean;
		testid?: string;
		children: Snippet;
	}

	let { edge = false, testid, children }: Props = $props();
</script>

<div class="section-stack" data-edge={edge ? '' : undefined} data-testid={testid}>
	{@render children()}
</div>

<style>
	.section-stack {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}
	.section-stack > :global(* + *),
	.section-stack[data-edge] {
		border-top: 1px solid var(--border);
	}
</style>

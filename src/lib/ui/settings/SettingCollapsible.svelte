<script lang="ts">
	import type { Snippet } from 'svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';

	interface Props {
		title: string;
		/** Remembers open or closed on this device under this key. */
		storageKey: string;
		defaultOpen?: boolean;
		/** How many settings it holds, shown beside the title while closed (Trevor, 2026-10-19). */
		count?: number;
		/**
		 * Each group on its own card, so groups read apart from each other (Trevor, 2026-11-06,
		 * picked "A: Cards" for the print settings).
		 */
		card?: boolean;
		children: Snippet;
	}

	let { title, storageKey, defaultOpen = true, count, card = false, children }: Props = $props();
</script>

<!-- A closing group of settings inside a section (Theme's colours, Board's Advanced). It is a
     setting row itself, so a line sits above it, and a line runs under its header while open:
     the same lines as every other setting (Trevor, 2026-10-24). -->
<div
	class="setting-collapsible"
	data-setting
	data-card={card || undefined}
	data-search-label={title}
>
	<Collapsible {title} level={3} {storageKey} {defaultOpen} {count}>
		{@render children()}
	</Collapsible>
</div>

<style>
	.setting-collapsible > :global(.collapsible > .body) {
		border-top: 1px solid var(--border);
	}
	.setting-collapsible[data-card] {
		padding-inline: var(--space-3);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--setting-card-background);
	}
	/* Cards sit apart with a gap, not the line between settings. */
	.setting-collapsible[data-card] + :global([data-setting]) {
		border-top: 0;
	}
</style>

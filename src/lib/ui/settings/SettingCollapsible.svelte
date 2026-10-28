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
		children: Snippet;
	}

	let { title, storageKey, defaultOpen = true, count, children }: Props = $props();
</script>

<!-- A closing group of settings inside a section (Theme's colours, Board's Advanced). It is a
     setting row itself, so a line sits above it, and a line runs under its header while open:
     the same lines as every other setting (Trevor, 2026-10-24). -->
<div class="setting-collapsible" data-setting data-search-label={title}>
	<Collapsible {title} level={3} {storageKey} {defaultOpen} {count}>
		{@render children()}
	</Collapsible>
</div>

<style>
	.setting-collapsible > :global(.collapsible > .body) {
		border-top: 1px solid var(--border);
	}
</style>

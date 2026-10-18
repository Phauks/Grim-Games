<script lang="ts">
	import type { Snippet } from 'svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';

	interface Props {
		title: string;
		/** Heading level: 2 for a section of the page, 3 inside another section. */
		level?: 2 | 3;
		/** Opens and closes from its header, remembered on this device under this key. */
		collapsible?: boolean;
		storageKey?: string;
		/** Shown open whatever was remembered (while a search is typed). */
		forceOpen?: boolean;
		/** Extra content at the end of the header row (a count, a button). */
		aside?: Snippet;
		/** A collapsible section that starts closed. */
		defaultOpen?: boolean;
		children: Snippet;
	}

	let {
		title,
		level = 2,
		collapsible = false,
		storageKey,
		forceOpen = false,
		aside,
		defaultOpen = true,
		children
	}: Props = $props();
	const id = $props.id();
</script>

<!-- One section of a Page: a heading at the one section size, its optional aside, its content. -->
{#if collapsible}
	<Collapsible {title} {level} {storageKey} {forceOpen} {aside} {defaultOpen}>
		<div class="body">{@render children()}</div>
	</Collapsible>
{:else}
	<section class="page-section" aria-labelledby="{id}-title">
		<div class="head">
			<svelte:element this={`h${level}`} id="{id}-title" class="title">{title}</svelte:element>
			{#if aside}<div class="aside">{@render aside()}</div>{/if}
		</div>
		<div class="body">{@render children()}</div>
	</section>
{/if}

<style>
	.page-section {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
	}
	.title {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: var(--section-title-size);
	}
	.aside {
		flex: none;
	}
	.body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-3);
	}
	.body > :global(*) {
		min-width: 0;
	}
</style>

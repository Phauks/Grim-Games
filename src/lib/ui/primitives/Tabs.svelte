<script lang="ts" generics="T extends string">
	import { Tabs } from '@ark-ui/svelte/tabs';
	import type { Snippet } from 'svelte';

	interface Props {
		value?: T;
		tabs: { value: T; label: string }[];
		/** Renders the panel for one tab. */
		panel: Snippet<[T]>;
		label?: string;
	}

	let { value = $bindable(), tabs, panel, label }: Props = $props();
</script>

<Tabs.Root
	value={value ?? tabs[0]?.value}
	onValueChange={(details) => (value = details.value as T)}
	lazyMount
>
	<Tabs.List aria-label={label}>
		{#each tabs as tab (tab.value)}
			<Tabs.Trigger value={tab.value}>{tab.label}</Tabs.Trigger>
		{/each}
		<Tabs.Indicator />
	</Tabs.List>
	{#each tabs as tab (tab.value)}
		<Tabs.Content value={tab.value}>{@render panel(tab.value)}</Tabs.Content>
	{/each}
</Tabs.Root>

<style>
	:global([data-scope='tabs'][data-part='list']) {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--space-1);
		border-bottom: 1px solid var(--border);
	}
	/* Tabs that don't fit move to a second row, whole, so the list never scrolls sideways
	   at large text sizes (Trevor, 2026-10-16). */
	:global([data-scope='tabs'][data-part='trigger']) {
		flex: none;
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		white-space: nowrap;
		border: 0;
		background: none;
		color: var(--on-surface-muted);
		font-family: var(--font-control);
		font-weight: var(--font-control-weight);
	}
	:global([data-scope='tabs'][data-part='trigger'][data-selected]) {
		color: var(--heading);
	}
	:global([data-scope='tabs'][data-part='indicator']) {
		left: var(--left);
		/* Under the selected tab, whichever row it is on. */
		top: calc(var(--top) + var(--height) - 0.1875 * var(--u));
		width: var(--width);
		height: calc(0.1875 * var(--u));
		background: var(--accent);
	}
	:global([data-scope='tabs'][data-part='content']) {
		padding-top: var(--space-4);
	}
</style>

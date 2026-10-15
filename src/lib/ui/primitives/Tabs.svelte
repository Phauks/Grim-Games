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
		gap: var(--space-1);
		overflow-x: auto;
		border-bottom: 1px solid var(--border);
	}
	:global([data-scope='tabs'][data-part='trigger']) {
		flex: none;
		min-height: var(--tap-target);
		padding: 0 var(--space-4);
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
		bottom: 0;
		width: var(--width);
		height: 3px;
		background: var(--accent);
	}
	:global([data-scope='tabs'][data-part='content']) {
		padding-top: var(--space-4);
	}
</style>

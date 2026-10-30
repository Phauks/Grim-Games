<script lang="ts">
	import { Menu } from '@ark-ui/svelte/menu';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { IconSlot } from '#lib/ui/icons/catalogue.ts';
	import { onLayerOpen } from './layers.ts';

	/**
	 * A menu behind an icon button, such as ⋯ (Trevor, 2026-10-26: "make them actual menu
	 * buttons"): a short list of actions, one row each, that opens on demand and closes on a
	 * pick. Drawn as Select's list is, so the two read as one family.
	 */
	interface Item {
		value: string;
		label: string;
		/** Shown but not usable now (Grim view before the room has a password). */
		disabled?: boolean;
		onSelect: () => void;
	}

	interface Props {
		/** The button's accessible name, also its tooltip. */
		label: string;
		icon?: IconSlot;
		items: Item[];
		/** Open; bound to open it from elsewhere (a held reminder's right-click). */
		open?: boolean;
		/** Where the list opens from the button: below it, or above it near a screen's foot. */
		placement?: 'bottom-end' | 'top';
	}

	let {
		label,
		icon = 'more',
		items,
		open = $bindable(false),
		placement = 'bottom-end'
	}: Props = $props();

	// A dialog or sheet opening over the page closes the menu, as Select's list does.
	$effect(() => {
		if (open) return onLayerOpen(() => (open = false));
	});
</script>

<Menu.Root
	{open}
	onOpenChange={(details) => (open = details.open)}
	onSelect={(details) => items.find((item) => item.value === details.value)?.onSelect()}
	positioning={{ strategy: 'fixed', placement, fitViewport: true, gutter: 4 }}
	lazyMount
	unmountOnExit
>
	<Menu.Trigger aria-label={label} title={label}><Icon name={icon} /></Menu.Trigger>
	<Menu.Positioner>
		<Menu.Content>
			{#each items as item (item.value)}
				<Menu.Item value={item.value} disabled={item.disabled}>{item.label}</Menu.Item>
			{/each}
		</Menu.Content>
	</Menu.Positioner>
</Menu.Root>

<style>
	/* The icon button's look (IconButton.svelte). */
	:global([data-scope='menu'][data-part='trigger']) {
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		padding: 0;
		border: 0;
		border-radius: var(--radius-full);
		background: none;
		color: var(--on-surface);
		cursor: pointer;
		touch-action: manipulation;
	}
	:global([data-scope='menu'][data-part='trigger']:is(:active, [data-state='open'])) {
		background: var(--surface-selected);
	}
	:global([data-scope='menu'][data-part='trigger']:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	:global([data-scope='menu'][data-part='positioner']) {
		z-index: var(--z-popover);
	}
	/* Select's list: the dialog colours, card edge and shadow. */
	:global([data-scope='menu'][data-part='content']) {
		min-width: calc(12 * var(--u));
		padding: var(--space-1);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--dialog-background);
		color: var(--dialog-color);
		box-shadow: var(--shadow);
		outline: none;
	}
	:global([data-scope='menu'][data-part='item']) {
		display: flex;
		align-items: center;
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-sm);
		font-family: var(--font-control);
		cursor: pointer;
		touch-action: manipulation;
	}
	:global([data-scope='menu'][data-part='item'][data-highlighted]) {
		background: var(--surface-selected);
	}
	:global([data-scope='menu'][data-part='item'][data-disabled]) {
		opacity: 0.5;
		cursor: default;
	}
</style>

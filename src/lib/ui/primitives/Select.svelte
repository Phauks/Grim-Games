<script lang="ts" generics="T extends string">
	import { createListCollection, Select } from '@ark-ui/svelte/select';
	import type { Snippet } from 'svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';

	interface Option {
		value: T;
		label: string;
		/** A short hint under the option's label in the list. */
		description?: string;
	}

	interface Props {
		label: string;
		/** Hide the label visually (it stays the accessible name). */
		hideLabel?: boolean;
		/** Id of a visible label elsewhere (e.g. a SettingRow's); then no label is rendered. */
		labelledBy?: string;
		value: T;
		options: Option[];
		onChange: (value: T) => void;
		/** Custom content for one option in the list; defaults to its label and description. */
		item?: Snippet<[Option]>;
		/** Custom content for the closed control; defaults to the chosen option's label. */
		selected?: Snippet<[Option]>;
	}

	let { label, hideLabel, labelledBy, value, options, onChange, item, selected }: Props = $props();

	const collection = $derived(
		createListCollection({
			items: options,
			itemToValue: (option) => option.value,
			itemToString: (option) => option.label
		})
	);
	const current = $derived(options.find((option) => option.value === value));
</script>

<!--
	A dropdown: one choice from a list that only opens on demand. The list is positioned
	`fixed` so it overlays dialogs and scroll boxes and never pushes anything down.
-->
<Select.Root
	{collection}
	value={[value]}
	onValueChange={(details) => details.value[0] && onChange(details.value[0] as T)}
	ids={labelledBy ? { label: labelledBy } : undefined}
	positioning={{ strategy: 'fixed', sameWidth: true, fitViewport: true, gutter: 4 }}
	lazyMount
	unmountOnExit
>
	{#if !labelledBy}
		<Select.Label class={hideLabel ? 'visually-hidden' : undefined}>{label}</Select.Label>
	{/if}
	<Select.Control>
		<Select.Trigger>
			<span class="value">
				{#if current && selected}{@render selected(current)}{:else}{current?.label ?? ''}{/if}
			</span>
			<Select.Indicator><Icon name="forward" /></Select.Indicator>
		</Select.Trigger>
	</Select.Control>
	<Select.Positioner>
		<Select.Content>
			{#each options as option (option.value)}
				<Select.Item item={option}>
					<Select.ItemText>
						{#if item}{@render item(option)}{:else}
							<span class="option-label">{option.label}</span>
							{#if option.description}<small>{option.description}</small>{/if}
						{/if}
					</Select.ItemText>
					<Select.ItemIndicator><Icon name="check" /></Select.ItemIndicator>
				</Select.Item>
			{/each}
		</Select.Content>
	</Select.Positioner>
</Select.Root>

<style>
	:global([data-scope='select'][data-part='label']) {
		display: block;
		margin-bottom: var(--space-2);
		font-family: var(--font-control);
		color: var(--on-surface-muted);
	}
	:global([data-scope='select'] .visually-hidden) {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	:global([data-scope='select'][data-part='trigger']) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2) var(--space-1) var(--space-3);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--choice-background);
		color: var(--choice-color);
		font-family: var(--font-control);
		text-align: left;
		cursor: pointer;
		touch-action: manipulation;
	}
	:global([data-scope='select'][data-part='trigger'][data-state='open']) {
		border-color: var(--choice-selected-border);
	}
	:global([data-scope='select'][data-part='trigger']:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.value {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* The caret points down, and up while the list is open. */
	:global([data-scope='select'][data-part='indicator']) {
		display: grid;
		place-items: center;
		flex: none;
		rotate: 90deg;
		color: var(--on-surface-muted);
		transition: rotate var(--duration-fast);
	}
	:global([data-scope='select'][data-part='indicator'][data-state='open']) {
		rotate: -90deg;
	}
	:global([data-scope='select'][data-part='positioner']) {
		z-index: var(--z-popover);
	}
	:global([data-scope='select'][data-part='content']) {
		max-height: min(60dvh, var(--available-height, 60dvh));
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: var(--space-1);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--dialog-background);
		color: var(--dialog-color);
		box-shadow: var(--shadow);
		outline: none;
	}
	:global([data-scope='select'][data-part='item']) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-sm);
		font-family: var(--font-control);
		cursor: pointer;
		touch-action: manipulation;
	}
	:global([data-scope='select'][data-part='item'][data-highlighted]) {
		background: var(--surface-selected);
	}
	:global([data-scope='select'][data-part='item'][data-state='checked']) {
		box-shadow: inset 0 0 0 1px var(--choice-selected-border);
	}
	:global([data-scope='select'][data-part='item-text']) {
		display: grid;
		min-width: 0;
	}
	:global([data-scope='select'][data-part='item-text'] small) {
		font-family: var(--font-body);
		font-size: 0.8rem;
		color: var(--on-surface-muted);
	}
	:global([data-scope='select'][data-part='item-indicator']) {
		display: grid;
		flex: none;
		color: var(--accent);
	}
	/* Only the chosen option shows its tick; the others keep the space, so labels line up. */
	:global([data-scope='select'][data-part='item-indicator'][hidden]) {
		visibility: hidden;
	}
</style>

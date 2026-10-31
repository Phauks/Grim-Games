<script lang="ts" generics="T extends string">
	import { createListCollection, Select } from '@ark-ui/svelte/select';
	import type { Snippet } from 'svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { IconSlot } from '#lib/ui/icons/catalogue.ts';
	import IconButton from './IconButton.svelte';
	import { onLayerOpen } from './layers.ts';

	interface Option {
		value: T;
		label: string;
		/** A short hint under the option's label in the list. */
		description?: string;
		/** The heading the option is listed under; options of one group are given together. */
		group?: string;
	}

	interface Props {
		label: string;
		/** Hide the label visually (it stays the accessible name). */
		hideLabel?: boolean;
		/** Id of a visible label elsewhere (e.g. a SettingRow's); then no label is rendered. */
		labelledBy?: string;
		value?: T;
		options: Option[];
		onChange?: (value: T) => void;
		/** Any number of options at once, each ticked in the list (a character's collections). */
		multiple?: boolean;
		/** The chosen options, with `multiple`. */
		values?: T[];
		onValuesChange?: (values: T[]) => void;
		/**
		 * A last option that does something instead of being chosen ("New collection"): picking
		 * it closes the list and runs it.
		 */
		action?: Option & { run: () => void };
		/** Shown in the closed control when nothing is chosen. */
		placeholder?: string;
		/** Custom content for one option in the list; defaults to its label and description. */
		item?: Snippet<[Option]>;
		/** Custom content for the closed control; defaults to the chosen option's label. */
		selected?: Snippet<[Option]>;
		/** Shown but not usable (a setting that depends on another one being on). */
		disabled?: boolean;
		/** False lets the list be as wide as its options (a closed control smaller than them). */
		listFitsTrigger?: boolean;
		/**
		 * The closed control is this icon on an IconButton, the very button beside it in a row of
		 * icon buttons (Print, Share), so it can never look different from them (Trevor,
		 * 2026-10-26). `label` is its name and tooltip; the list is as wide as its options.
		 */
		icon?: IconSlot;
		/**
		 * Nothing is chosen yet and something waits on a choice (the character a drunk
		 * Investigator is shown, Trevor 2026-10-28): the closed control is ringed in the accent.
		 */
		attention?: boolean;
		/** Whether the list is open; bind it to open the list from elsewhere. */
		open?: boolean;
		/**
		 * At least this many characters wide (a NumberSelect's longest number), so a longer choice
		 * never resizes the control where nothing else sets its width.
		 */
		chars?: number;
		/** On the closed control, which shows the chosen option's label. */
		testid?: string;
	}

	let {
		label,
		hideLabel,
		labelledBy,
		value,
		options,
		onChange,
		multiple = false,
		values,
		onValuesChange,
		placeholder = '',
		action,
		item,
		selected,
		disabled,
		listFitsTrigger = true,
		icon,
		attention = false,
		open = $bindable(false),
		chars,
		testid
	}: Props = $props();

	// A dialog or sheet opening over the page closes the list, so it never stays on top of it.
	$effect(() => {
		if (open) return onLayerOpen(() => (open = false));
	});
	/*
	 * Scrolling what is under the list closes it, so it never rides along over a scroll box's
	 * edge (Trevor, 2026-10-23: it "eventually shows up beneath the area"). Scrolling the list
	 * itself doesn't.
	 */
	$effect(() => {
		if (!open) return;
		const close = (event: Event) => {
			const target = event.target;
			if (target instanceof Element && target.closest("[data-scope='select'][data-part='content']"))
				return;
			open = false;
		};
		addEventListener('scroll', close, { capture: true, passive: true });
		return () => removeEventListener('scroll', close, { capture: true });
	});

	function change(next: T[]) {
		if (action && next.includes(action.value)) {
			open = false;
			action.run();
			return;
		}
		if (multiple) onValuesChange?.(next);
		else if (next[0]) onChange?.(next[0]);
	}
	const items = $derived(action ? [...options, action] : options);
	const collection = $derived(
		createListCollection({
			items,
			itemToValue: (option) => option.value,
			itemToString: (option) => option.label
		})
	);
	const chosen = $derived(multiple ? (values ?? []) : value === undefined ? [] : [value]);
	const current = $derived(options.find((option) => option.value === chosen[0]));
	/** What the closed control says: the chosen option, or every chosen one with `multiple`. */
	const shown = $derived(
		multiple
			? options
					.filter((option) => chosen.includes(option.value))
					.map((option) => option.label)
					.join(', ') || placeholder
			: (current?.label ?? placeholder)
	);
	/** Runs of options under the same heading, in the given order (one untitled run without groups). */
	const groups = $derived(
		items.reduce<{ title?: string; options: Option[] }[]>((runs, option) => {
			const last = runs.at(-1);
			if (last && last.title === option.group) last.options.push(option);
			else runs.push({ title: option.group, options: [option] });
			return runs;
		}, [])
	);
</script>

{#snippet optionItem(option: Option)}
	<Select.Item item={option}>
		<Select.ItemText>
			{#if item}{@render item(option)}{:else}
				<span class="option-label">{option.label}</span>
				{#if option.description}<small>{option.description}</small>{/if}
			{/if}
		</Select.ItemText>
		<Select.ItemIndicator><Icon name="check" /></Select.ItemIndicator>
	</Select.Item>
{/snippet}

<!--
	A dropdown: one choice (or, with `multiple`, any number) from a list that only opens on demand. The list is positioned
	`fixed` so it overlays dialogs and scroll boxes and never pushes anything down.
-->
<Select.Root
	{collection}
	{multiple}
	closeOnSelect={!multiple}
	value={chosen}
	{open}
	onOpenChange={(details) => (open = details.open)}
	onValueChange={(details) => change(details.value as T[])}
	ids={labelledBy ? { label: labelledBy } : undefined}
	{disabled}
	positioning={{
		strategy: 'fixed',
		sameWidth: listFitsTrigger && !icon,
		fitViewport: true,
		gutter: 4
	}}
	lazyMount
	unmountOnExit
	style={chars === undefined ? undefined : `--select-chars: ${chars}`}
>
	{#if !labelledBy}
		<Select.Label class={hideLabel || icon ? 'visually-hidden' : undefined}>{label}</Select.Label>
	{/if}
	<Select.Control>
		{#if icon}
			<Select.Trigger>
				{#snippet asChild(props)}
					<IconButton {...props()} {icon} {label} />
				{/snippet}
			</Select.Trigger>
		{:else}
			<Select.Trigger data-attention={attention || undefined} data-testid={testid}>
				<span class="value">
					{#if current && selected && !multiple}{@render selected(current)}{:else}{shown}{/if}
				</span>
				<Select.Indicator><Icon name="forward" /></Select.Indicator>
			</Select.Trigger>
		{/if}
	</Select.Control>
	<Select.Positioner>
		<Select.Content>
			{#each groups as group, i (group.title ?? i)}
				{#if group.title}
					<Select.ItemGroup>
						<Select.ItemGroupLabel>{group.title}</Select.ItemGroupLabel>
						{#each group.options as option (option.value)}{@render optionItem(option)}{/each}
					</Select.ItemGroup>
				{:else}
					{#each group.options as option (option.value)}{@render optionItem(option)}{/each}
				{/if}
			{/each}
		</Select.Content>
	</Select.Positioner>
</Select.Root>

<style>
	/* The label and list are shared with Combobox, the drop-down you can type into. */
	:global(:is([data-scope='select'], [data-scope='combobox'])[data-part='label']) {
		display: block;
		margin-bottom: var(--space-2);
		font-family: var(--font-control);
		color: var(--on-surface-muted);
	}
	:global(:is([data-scope='select'], [data-scope='combobox']) .visually-hidden) {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	/* Room for `chars` characters, the caret and the padding beside them. */
	:global([data-scope='select'][data-part='root'][style*='--select-chars']) {
		min-width: calc(var(--select-chars) * 1ch + var(--space-3) + var(--space-2) * 2 + 1.5em);
	}
	/* An `icon` trigger is an IconButton and keeps that look alone. */
	:global([data-scope='select'][data-part='trigger']:not(.icon-button)) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2) var(--space-1) var(--space-3);
		border: var(--control-border);
		border-radius: var(--card-radius);
		background: var(--choice-background);
		color: var(--choice-color);
		font-family: var(--font-control);
		text-align: left;
		cursor: pointer;
		touch-action: manipulation;
	}
	:global([data-scope='select'][data-part='trigger'][data-state='open']:not(.icon-button)) {
		border-color: var(--choice-selected-border);
	}
	/* A choice something waits on: the accent edge, drawn inside so nothing moves. */
	:global([data-scope='select'][data-part='trigger'][data-attention]:not(.icon-button)) {
		border-color: var(--accent);
		box-shadow:
			inset 0 0 0 1px var(--accent),
			0 0 0 2px var(--accent-wash);
		color: var(--accent);
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
	:global(:is([data-scope='select'], [data-scope='combobox'])[data-part='positioner']) {
		z-index: var(--z-popover);
	}
	:global(:is([data-scope='select'], [data-scope='combobox'])[data-part='content']) {
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
	:global(:is([data-scope='select'], [data-scope='combobox'])[data-part='item']) {
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
	/* A group's heading: small and muted, like the field labels. */
	:global(:is([data-scope='select'], [data-scope='combobox'])[data-part='item-group-label']) {
		padding: var(--space-2) var(--space-3) var(--space-1);
		font-family: var(--font-control);
		font-size: 0.8rem;
		color: var(--on-surface-muted);
	}
	:global(:is([data-scope='select'], [data-scope='combobox'])[data-part='item'][data-highlighted]) {
		background: var(--surface-selected);
	}
	:global(
		:is([data-scope='select'], [data-scope='combobox'])[data-part='item'][data-state='checked']
	) {
		box-shadow: inset 0 0 0 1px var(--choice-selected-border);
	}
	:global(:is([data-scope='select'], [data-scope='combobox'])[data-part='item-text']) {
		display: grid;
		min-width: 0;
	}
	:global(:is([data-scope='select'], [data-scope='combobox'])[data-part='item-text'] small) {
		font-family: var(--font-body);
		font-size: 0.8rem;
		color: var(--on-surface-muted);
	}
	:global(:is([data-scope='select'], [data-scope='combobox'])[data-part='item-indicator']) {
		display: grid;
		flex: none;
		color: var(--accent);
	}
	/* Only the chosen option shows its tick; the others keep the space, so labels line up. */
	:global(:is([data-scope='select'], [data-scope='combobox'])[data-part='item-indicator'][hidden]) {
		visibility: hidden;
	}
</style>

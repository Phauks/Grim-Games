<script lang="ts" generics="T extends string">
	import { foldForSearch } from '#lib/core/text/fold.ts';
	import { Combobox, createListCollection } from '@ark-ui/svelte/combobox';
	import { tick, type Snippet } from 'svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import ClearableField from './ClearableField.svelte';

	/**
	 * A drop-down you can type into (Trevor, 2026-10-19: "perhaps a typable dropdown or
	 * search" for 50 scripts): typing narrows the list to options whose label or description
	 * holds the text. The list looks and is placed like Select's (it shares Select's styles),
	 * overlaying the page so nothing moves. Closed, the field shows the chosen option.
	 */
	interface Option {
		value: T;
		label: string;
		/** A short line under the option's label in the list. */
		description?: string;
		/** The heading the option is listed under; options of one group are given together. */
		group?: string;
	}

	interface Props {
		label: string;
		/** Hide the label visually (it stays the accessible name). */
		hideLabel?: boolean;
		value?: T;
		options: Option[];
		onChange?: (value: T) => void;
		/**
		 * A last row that does something with the typed text instead of being chosen ("Find
		 * more online"); undefined for none.
		 */
		action?: (query: string) => (Option & { run: () => void }) | undefined;
		/** Shown in the empty field. */
		placeholder?: string;
		/** Shown in the list when nothing matches. */
		empty: string;
		item?: Snippet<[Option]>;
		/** Shown in place but not usable, so nothing moves when it becomes usable. */
		disabled?: boolean;
		testid?: string;
		/**
		 * Any typed text is the value, the options only fill it in (a player's name: picked from
		 * the room's phones or typed, PlayerNameInput). `onChange` runs on every keystroke, and
		 * Enter with the list closed keeps the text and closes the phone keyboard.
		 */
		free?: boolean;
	}

	let {
		label,
		hideLabel,
		value,
		options,
		onChange,
		action,
		placeholder = '',
		empty,
		item,
		disabled = false,
		testid,
		free = false
	}: Props = $props();

	const current = $derived(options.find((o) => o.value === value));
	// The field shows the chosen option, and again whenever the choice changes.
	let text = $derived(free ? (value ?? '') : (current?.label ?? ''));
	let open = $state(false);

	/** The typed text, unless it is just the chosen option's name (then every option shows). */
	const query = $derived(text === (current?.label ?? '') ? '' : foldForSearch(text.trim()));
	const matching = $derived(
		query
			? options.filter((o) =>
					[o.label, o.description ?? ''].some((s) => foldForSearch(s).includes(query))
				)
			: options
	);
	const extra = $derived(action?.(text.trim()));
	const items = $derived(extra ? [...matching, extra] : matching);
	const collection = $derived(
		createListCollection({
			items,
			itemToValue: (o) => o.value,
			itemToString: (o) => o.label
		})
	);
	const groups = $derived(
		items.reduce<{ title?: string; options: Option[] }[]>((runs, o) => {
			const last = runs.at(-1);
			if (last && last.title === o.group) last.options.push(o);
			else runs.push({ title: o.group, options: [o] });
			return runs;
		}, [])
	);

	function change(next: string[]) {
		const picked = next[0];
		if (!picked) return;
		// Held before the text resets: `extra` is worked out from the typed text.
		const act = extra;
		if (act && picked === act.value) {
			open = false;
			text = current?.label ?? '';
			act.run();
			// The list resets the field once it closes; it then shows what the action chose.
			void tick().then(() => (text = current?.label ?? ''));
			return;
		}
		onChange?.(picked as T);
	}
</script>

{#snippet optionItem(option: Option)}
	<Combobox.Item item={option}>
		<Combobox.ItemText>
			{#if item}{@render item(option)}{:else}
				<span class="option-label">{option.label}</span>
				{#if option.description}<small>{option.description}</small>{/if}
			{/if}
		</Combobox.ItemText>
		<Combobox.ItemIndicator><Icon name="check" /></Combobox.ItemIndicator>
	</Combobox.Item>
{/snippet}

<Combobox.Root
	{collection}
	value={current ? [current.value] : []}
	inputValue={text}
	{open}
	onOpenChange={(details) => (open = details.open)}
	onInputValueChange={(details) => {
		text = details.inputValue;
		if (free) onChange?.(details.inputValue as T);
	}}
	allowCustomValue={free}
	onValueChange={(details) => change(details.value)}
	openOnClick
	selectionBehavior="replace"
	positioning={{ strategy: 'fixed', sameWidth: true, fitViewport: true, gutter: 4 }}
	lazyMount
	unmountOnExit
	{disabled}
	data-testid={testid}
>
	<Combobox.Label class={hideLabel ? 'visually-hidden' : undefined}>{label}</Combobox.Label>
	<Combobox.Control>
		<!-- A name is typed, not searched for: no search icon. -->
		{#if !free}<span class="search"><Icon name="search" /></span>{/if}
		<ClearableField
			bind:value={text}
			{disabled}
			onclear={() => {
				if (free) onChange?.('' as T);
				open = true;
			}}
		>
			<Combobox.Input
				{placeholder}
				enterkeyhint={free ? 'done' : undefined}
				onkeydown={(event) => {
					// No option highlighted: Enter keeps what was typed.
					const input = event.currentTarget as HTMLInputElement;
					if (!free || event.key !== 'Enter' || input.getAttribute('aria-activedescendant')) return;
					open = false;
					// After the list has closed, as closing it puts the focus back in the field.
					setTimeout(() => input.blur());
				}}
			/>
		</ClearableField>
		<Combobox.Trigger aria-label={label}><Icon name="forward" /></Combobox.Trigger>
	</Combobox.Control>
	<!-- A free field with nothing to fill in shows no list: the typed text is the answer. -->
	{#if !free || matching.length > 0}<Combobox.Positioner>
			<Combobox.Content>
				{#each groups as group, i (group.title ?? i)}
					{#if group.title}
						<Combobox.ItemGroup>
							<Combobox.ItemGroupLabel>{group.title}</Combobox.ItemGroupLabel>
							{#each group.options as option (option.value)}{@render optionItem(option)}{/each}
						</Combobox.ItemGroup>
					{:else}
						{#each group.options as option (option.value)}{@render optionItem(option)}{/each}
					{/if}
				{/each}
				{#if matching.length === 0}<p class="empty">{empty}</p>{/if}
			</Combobox.Content>
		</Combobox.Positioner>{/if}
</Combobox.Root>

<style>
	/* The closed field looks like Select's control, with a search icon and a caret. */
	:global([data-scope='combobox'][data-part='control']) {
		display: flex;
		align-items: center;
		min-height: var(--tap-target);
		padding-inline: var(--space-2) 0;
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--choice-background);
		color: var(--choice-color);
	}
	/* The whole field shows the focus ring, not the input inside it (base.css's text fields). */
	:global([data-scope='combobox'][data-part='control']:has(input:focus-visible)) {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
		border-color: var(--focus);
	}
	:global([data-scope='combobox'][data-part='input']:focus-visible) {
		outline: none;
	}
	.search {
		display: grid;
		flex: none;
		color: var(--on-surface-muted);
	}
	:global([data-scope='combobox'][data-part='input']) {
		min-height: var(--tap-target);
		padding: 0 var(--space-2);
		border: 0;
		background: none;
		color: inherit;
		font-family: var(--font-control);
		font-size: 1rem;
		outline: none;
	}
	:global([data-scope='combobox'][data-part='trigger']) {
		display: grid;
		place-items: center;
		flex: none;
		width: var(--tap-target);
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: var(--on-surface-muted);
		rotate: 90deg;
		cursor: pointer;
		transition: rotate var(--duration-fast);
	}
	:global([data-scope='combobox'][data-part='trigger'][data-state='open']) {
		rotate: -90deg;
	}
	.empty {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		color: var(--on-surface-muted);
	}
</style>

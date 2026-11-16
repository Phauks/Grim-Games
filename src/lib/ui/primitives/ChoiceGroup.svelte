<script lang="ts" generics="T extends string">
	import { RadioGroup } from '@ark-ui/svelte/radio-group';
	import type { Snippet } from 'svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';

	interface Option {
		value: T;
		label: string;
		/** Shown but not choosable, as `disabled` for one option. */
		disabled?: boolean;
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
		/**
		 * `cards` wraps large tappable cards; `row` is a compact line (icons); `joined` is one
		 * full-width pill split into its options (Official or Custom; Trevor, 2026-11-16).
		 */
		layout?: 'cards' | 'row' | 'joined';
		/** Custom content for one option; defaults to its label. */
		item?: Snippet<[Option]>;
		/**
		 * The option a rule says should be chosen (the Scarlet Woman as the new Demon): it takes a
		 * whole line in the host's `--choice-emphasis` colour, and keeps it, with a warning edge,
		 * while another option is chosen. Never locks the choice.
		 */
		emphasized?: T;
		/** Shown but not choosable (no reflow while it has no effect). */
		disabled?: boolean;
		/**
		 * A tap on the chosen option clears the choice, `onChange('')`, so the group needs no
		 * "None" option (Trevor, 2026-11-10: "just click to deselect current"). `value` is
		 * then '' while nothing is chosen.
		 */
		clearable?: boolean;
	}

	let {
		label,
		hideLabel,
		labelledBy,
		value,
		options,
		onChange,
		layout = 'cards',
		item,
		emphasized,
		disabled = false,
		clearable = false
	}: Props = $props();
</script>

<!-- A radio group of tappable cards: one choice, every option visible at once. -->
<RadioGroup.Root
	value={value || null}
	onValueChange={(details) => details.value && onChange(details.value as T)}
	aria-labelledby={labelledBy}
	data-layout={layout}
	{disabled}
>
	{#if !labelledBy}
		<RadioGroup.Label class={hideLabel ? 'visually-hidden' : undefined}>{label}</RadioGroup.Label>
	{/if}
	<div class="options">
		{#each options as option (option.value)}
			<RadioGroup.Item
				value={option.value}
				disabled={option.disabled}
				onclick={clearable && !disabled && option.value === value
					? (event: MouseEvent) => {
							// Not passed on to the radio, which would choose it again.
							event.preventDefault();
							onChange('' as T);
						}
					: undefined}
				data-emphasized={option.value === emphasized
					? value === emphasized
						? 'chosen'
						: 'passed-over'
					: undefined}
			>
				<RadioGroup.ItemControl />
				<RadioGroup.ItemText>
					{#if item}{@render item(option)}{:else}{option.label}{/if}
				</RadioGroup.ItemText>
				{#if option.value === emphasized && value !== emphasized}<span
						class="passed-over"
						role="img"
						aria-label="Warning"><Icon name="warning" /></span
					>{/if}
				<RadioGroup.ItemHiddenInput />
			</RadioGroup.Item>
		{/each}
	</div>
</RadioGroup.Root>

<style>
	.options {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(9.5 * var(--u))), 1fr));
		gap: var(--space-2);
	}
	:global([data-scope='radio-group'][data-layout='row']) .options {
		display: flex;
		flex-wrap: wrap;
	}
	:global([data-scope='radio-group'][data-part='label']) {
		display: block;
		font-family: var(--font-control);
		margin-bottom: var(--space-2);
		color: var(--on-surface-muted);
	}
	:global([data-scope='radio-group'] .visually-hidden) {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	:global([data-scope='radio-group'][data-part='item']) {
		position: relative;
		display: flex;
		align-items: center;
		min-width: var(--tap-target);
		min-height: var(--tap-target);
		padding: var(--space-2) var(--space-3);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--choice-background);
		color: var(--choice-color);
		cursor: pointer;
		touch-action: manipulation;
	}
	:global([data-scope='radio-group'][data-part='item'][data-disabled]) {
		opacity: 0.5;
		cursor: default;
	}
	:global([data-scope='radio-group'][data-part='item'][data-state='checked']) {
		border-color: var(--choice-selected-border);
		background: var(--choice-selected-background);
		box-shadow: inset 0 0 0 1px var(--choice-selected-border);
	}
	/* The option a rule says should be chosen: a whole line, a thick edge and a glow. */
	:global([data-scope='radio-group'][data-part='item'][data-emphasized]) {
		grid-column: 1 / -1;
		border: calc(0.25 * var(--u)) solid var(--choice-emphasis, var(--accent));
		box-shadow: 0 0 var(--space-3) var(--choice-emphasis, var(--accent));
	}
	:global([data-scope='radio-group'][data-part='item'][data-emphasized='passed-over']) {
		border-style: dashed;
		box-shadow: none;
	}
	.passed-over {
		flex: none;
		margin-left: var(--space-2);
		color: var(--choice-emphasis, var(--accent));
		font-size: 1.25em;
	}
	:global([data-scope='radio-group'][data-part='item'][data-focus-visible]) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	/* The selected border carries the state; the control dot is not drawn. */
	:global([data-scope='radio-group'][data-part='item-control']) {
		display: none;
	}
	:global([data-scope='radio-group'][data-part='item-text']) {
		display: block;
		font-family: var(--font-control);
		width: 100%;
	}
	/* One pill: the options share their edges, only the outer ends are rounded. */
	:global([data-scope='radio-group'][data-layout='joined']) .options {
		display: flex;
		gap: 0;
	}
	:global([data-scope='radio-group'][data-layout='joined'] [data-part='item']) {
		flex: 1 1 0;
		min-width: 0;
		justify-content: center;
		padding-inline: var(--space-2);
		text-align: center;
		border-radius: 0;
	}
	/* On the narrowest phone at the largest text a long name is cut short, never wider. */
	:global([data-scope='radio-group'][data-layout='joined'] [data-part='item-text']) {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	:global(
		[data-scope='radio-group'][data-layout='joined'] [data-part='item'] + [data-part='item']
	) {
		margin-inline-start: -1px; /* px-ok: the hairline edges overlap (--card-border is 1px) */
	}
	:global([data-scope='radio-group'][data-layout='joined'] [data-part='item']:first-child) {
		border-start-start-radius: var(--radius-full);
		border-end-start-radius: var(--radius-full);
	}
	:global([data-scope='radio-group'][data-layout='joined'] [data-part='item']:last-child) {
		border-start-end-radius: var(--radius-full);
		border-end-end-radius: var(--radius-full);
	}
	/* The chosen option's whole edge shows over its neighbours'. */
	:global(
		[data-scope='radio-group'][data-layout='joined'] [data-part='item'][data-state='checked']
	) {
		z-index: var(--z-above);
	}
	:global([data-scope='radio-group'][data-layout='row'] [data-part='item']) {
		justify-content: center;
		padding: var(--space-2);
	}
</style>

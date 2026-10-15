<script lang="ts" generics="T extends string">
	import { RadioGroup } from '@ark-ui/svelte/radio-group';
	import type { Snippet } from 'svelte';

	interface Option {
		value: T;
		label: string;
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
		/** `cards` wraps large tappable cards; `row` is a compact line (icons). */
		layout?: 'cards' | 'row';
		/** Custom content for one option; defaults to its label. */
		item?: Snippet<[Option]>;
	}

	let {
		label,
		hideLabel,
		labelledBy,
		value,
		options,
		onChange,
		layout = 'cards',
		item
	}: Props = $props();
</script>

<!-- A radio group of tappable cards: one choice, every option visible at once. -->
<RadioGroup.Root
	{value}
	onValueChange={(details) => details.value && onChange(details.value as T)}
	aria-labelledby={labelledBy}
	data-layout={layout}
>
	{#if !labelledBy}
		<RadioGroup.Label class={hideLabel ? 'visually-hidden' : undefined}>{label}</RadioGroup.Label>
	{/if}
	<div class="options">
		{#each options as option (option.value)}
			<RadioGroup.Item value={option.value}>
				<RadioGroup.ItemControl />
				<RadioGroup.ItemText>
					{#if item}{@render item(option)}{:else}{option.label}{/if}
				</RadioGroup.ItemText>
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
	:global([data-scope='radio-group'][data-part='item'][data-state='checked']) {
		border-color: var(--choice-selected-border);
		background: var(--choice-selected-background);
		box-shadow: inset 0 0 0 1px var(--choice-selected-border);
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
		width: 100%;
	}
	:global([data-scope='radio-group'][data-layout='row'] [data-part='item']) {
		justify-content: center;
		padding: var(--space-2);
	}
</style>

<script lang="ts" generics="T extends string">
	import { SegmentGroup } from '@ark-ui/svelte/segment-group';
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
		item?: Snippet<[Option]>;
	}

	let { label, hideLabel, labelledBy, value, options, onChange, item }: Props = $props();
</script>

<!-- A short row of mutually exclusive options with a sliding indicator. -->
<SegmentGroup.Root
	{value}
	onValueChange={(details) => details.value && onChange(details.value as T)}
	aria-labelledby={labelledBy}
>
	{#if !labelledBy}
		<SegmentGroup.Label class={hideLabel ? 'visually-hidden' : undefined}>
			{label}
		</SegmentGroup.Label>
	{/if}
	<div class="track">
		<SegmentGroup.Indicator />
		{#each options as option (option.value)}
			<SegmentGroup.Item value={option.value}>
				<SegmentGroup.ItemText>
					{#if item}{@render item(option)}{:else}{option.label}{/if}
				</SegmentGroup.ItemText>
				<SegmentGroup.ItemControl />
				<SegmentGroup.ItemHiddenInput />
			</SegmentGroup.Item>
		{/each}
	</div>
</SegmentGroup.Root>

<style>
	.track {
		position: relative;
		display: flex;
		padding: var(--space-1);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--choice-background);
	}
	:global([data-scope='segment-group'][data-part='label']) {
		display: block;
		margin-bottom: var(--space-2);
		color: var(--on-surface-muted);
	}
	:global([data-scope='segment-group'] .visually-hidden) {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	:global([data-scope='segment-group'][data-part='item']) {
		position: relative;
		z-index: 1;
		flex: 1;
		display: grid;
		place-items: center;
		min-height: var(--tap-target);
		padding: 0 var(--space-2);
		color: var(--choice-color);
		cursor: pointer;
		touch-action: manipulation;
	}
	:global([data-scope='segment-group'][data-part='item'][data-focus-visible]) {
		outline: 3px solid var(--focus);
		outline-offset: -3px;
		border-radius: var(--radius-sm);
	}
	:global([data-scope='segment-group'][data-part='indicator']) {
		left: var(--left);
		top: var(--top);
		width: var(--width);
		height: var(--height);
		border-radius: var(--radius-sm);
		background: var(--choice-selected-background);
		box-shadow: inset 0 0 0 2px var(--choice-selected-border);
	}
	:global([data-scope='segment-group'][data-part='item-control']) {
		display: none;
	}
</style>

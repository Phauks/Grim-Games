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
		/** Shown but not usable (a setting that depends on another one being on). */
		disabled?: boolean;
	}

	let { label, hideLabel, labelledBy, value, options, onChange, item, disabled }: Props = $props();
</script>

<!-- A short row of mutually exclusive options with a sliding indicator. -->
<SegmentGroup.Root
	{value}
	onValueChange={(details) => details.value && onChange(details.value as T)}
	aria-labelledby={labelledBy}
	{disabled}
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
		/* Keeps the items' z-index inside the control, so they never paint over a sticky header
		   such as the Settings preview (Trevor, 2026-10-17). */
		isolation: isolate;
		display: flex;
		padding: var(--space-1);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--choice-background);
	}
	:global([data-scope='segment-group'][data-part='label']) {
		display: block;
		font-family: var(--font-control);
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
		/* Shrink and wrap a long label rather than widen the page (no sideways scrolling). */
		min-width: 0;
		display: grid;
		place-items: center;
		text-align: center;
		overflow-wrap: anywhere;
		min-height: var(--tap-target);
		padding: 0 var(--space-2);
		color: var(--choice-color);
		font-family: var(--font-control);
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
	/* Shown in place but not usable, so nothing reflows when it becomes available. */
	:global([data-scope='segment-group'][data-part='root'][data-disabled]) {
		opacity: 0.5;
	}
	:global([data-scope='segment-group'][data-part='item'][data-disabled]) {
		cursor: not-allowed;
	}
	:global([data-scope='segment-group'][data-part='item-control']) {
		display: none;
	}
</style>

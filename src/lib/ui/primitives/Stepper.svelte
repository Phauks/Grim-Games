<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconButton from './IconButton.svelte';

	/**
	 * A number with − and + buttons either side (component review, 2026-10-18: the player
	 * count, the alignment draw and the game mode deal each drew their own). The buttons are
	 * disabled at `min` and `max`; the value is shown in an `<output>` named by `label`.
	 */
	interface Props {
		value: number;
		/** Names the number, e.g. "Players". */
		label: string;
		/** The − button's name, e.g. "Fewer players". */
		lessLabel: string;
		/** The + button's name, e.g. "More players". */
		moreLabel: string;
		min?: number;
		max?: number;
		onchange?: (value: number) => void;
		/** Shown in place of the number, e.g. "Minions 2". */
		display?: Snippet;
		/** A larger number, for a page's main count (the player count). */
		large?: boolean;
		/** Shown but not usable, e.g. a number the current choice doesn't use. */
		disabled?: boolean;
		testid?: string;
	}

	let {
		value = $bindable(),
		label,
		lessLabel,
		moreLabel,
		min = 0,
		max = Infinity,
		onchange,
		display,
		large = false,
		disabled = false,
		testid
	}: Props = $props();

	function set(next: number) {
		next = Math.min(max, Math.max(min, next));
		if (next === value) return;
		value = next;
		onchange?.(next);
	}
</script>

<span class={['stepper', large && 'large']} data-disabled={disabled || undefined}>
	<IconButton
		icon="minus"
		label={lessLabel}
		disabled={disabled || value <= min}
		onclick={() => set(value - 1)}
	/>
	<output aria-label={label} data-testid={testid}
		>{#if display}{@render display()}{:else}{value}{/if}</output
	>
	<IconButton
		icon="add"
		label={moreLabel}
		disabled={disabled || value >= max}
		onclick={() => set(value + 1)}
	/>
</span>

<style>
	.stepper {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}
	output {
		min-width: 2ch;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	[data-disabled] output {
		opacity: 0.5;
	}
	.large output {
		font-size: 1.4rem;
		font-weight: 700;
	}
</style>

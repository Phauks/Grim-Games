<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconButton from './IconButton.svelte';
	import ClearableField from './ClearableField.svelte';

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
		/**
		 * The number can also be typed (Trevor, 2026-10-18: "Your number is"), with the
		 * phone's number keyboard. Not with `display`.
		 */
		typeable?: boolean;
		/** Enter in the typed number, e.g. to confirm the dialog it sits in. */
		oncommit?: () => void;
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
		testid,
		typeable = false,
		oncommit
	}: Props = $props();

	/** What is typed; digits only. Empty (after the X) keeps the number until typing. */
	let text = $derived(String(value));
	function typed(input: HTMLInputElement) {
		const digits = input.value.replace(/\D/g, '');
		// Written back at once: when only a letter was typed the state doesn't change, so
		// Svelte would leave the letter showing (Trevor, 2026-10-18).
		input.value = digits;
		text = digits;
		if (digits !== '') set(Number(digits));
	}

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
	{#if typeable && !display}
		<ClearableField bind:value={text} {disabled} class="typed">
			<input
				type="text"
				inputmode="numeric"
				pattern="[0-9]*"
				enterkeyhint="done"
				autocomplete="off"
				aria-label={label}
				data-testid={testid}
				{disabled}
				value={text}
				oninput={(event) => typed(event.currentTarget)}
				onblur={() => (text = String(value))}
				onkeydown={(event) => {
					if (event.key !== 'Enter') return;
					event.preventDefault();
					text = String(value);
					oncommit?.();
				}}
			/>
		</ClearableField>
	{:else}
		<output aria-label={label} data-testid={testid}
			>{#if display}{@render display()}{:else}{value}{/if}</output
		>
	{/if}
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
	/* Typed numbers: as wide as a few digits, a full tap target high. */
	input {
		width: 5ch;
		min-height: var(--tap-target);
		padding: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.large input {
		font-size: 1.4rem;
		font-weight: 700;
	}
	[data-disabled] output {
		opacity: 0.5;
	}
	.large output {
		font-size: 1.4rem;
		font-weight: 700;
	}
</style>

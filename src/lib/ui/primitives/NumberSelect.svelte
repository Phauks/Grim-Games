<script lang="ts">
	import Select from './Select.svelte';
	import { numberChoices } from './number-choices.ts';

	/**
	 * A number picked from a drop-down (Trevor, 2026-10-30: "the dropdown is sufficient ... why
	 * create more weird input areas"). It replaced the − and + Stepper and its typed box
	 * everywhere: the player count, the timer's time per living player, info token numbers.
	 */
	interface Props {
		value: number;
		/** Names the number, e.g. "Players". */
		label: string;
		/** Hide the label visually, where a visible one sits beside it. */
		hideLabel?: boolean;
		/** Id of a visible label elsewhere (a SettingRow's); then no label is rendered. */
		labelledBy?: string;
		min?: number;
		max: number;
		/** Only these numbers between `min` and `max`, e.g. set times; by default every one. */
		values?: readonly number[];
		/** How a number reads in the list and the closed control, e.g. "30 seconds". */
		format?: (value: number) => string;
		onchange?: (value: number) => void;
		/** Shown but not usable, e.g. a number the current choice doesn't use. */
		disabled?: boolean;
		testid?: string;
	}

	let {
		value = $bindable(),
		label,
		hideLabel,
		labelledBy,
		min = 0,
		max,
		values,
		format = String,
		onchange,
		disabled = false,
		testid
	}: Props = $props();

	const options = $derived(
		numberChoices(min, max, value, values).map((n) => ({ value: String(n), label: format(n) }))
	);
	const chars = $derived(Math.max(...options.map((option) => option.label.length)));

	function set(next: string) {
		const n = Number(next);
		if (n === value) return;
		value = n;
		onchange?.(n);
	}
</script>

<Select
	{label}
	{hideLabel}
	{labelledBy}
	value={String(value)}
	{options}
	onChange={set}
	{disabled}
	{chars}
	{testid}
/>

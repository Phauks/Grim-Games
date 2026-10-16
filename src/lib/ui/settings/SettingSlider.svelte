<script lang="ts">
	import Button from '#lib/ui/primitives/Button.svelte';
	import SettingRow from './SettingRow.svelte';

	interface Props {
		label: string;
		description?: string;
		/** The saved value, e.g. 1.25 for 125%. */
		value: number;
		min: number;
		max: number;
		step: number;
		/** What Reset goes back to; Reset is disabled while the value is already there. */
		defaultValue: number;
		/** Text for the Reset button, e.g. "Reset to 100%", in the interface language. */
		resetLabel: string;
		/** How the value reads beside the slider; a whole percentage by default. */
		format?: (value: number) => string;
		/** Called when a drag ends, a key is pressed or Reset is tapped, not on every move. */
		onChange: (value: number) => void;
	}

	let {
		label,
		description,
		value,
		min,
		max,
		step,
		defaultValue,
		resetLabel,
		format = (v) => `${Math.round(v * 100)}%`,
		onChange
	}: Props = $props();

	// Follows the finger while dragging; the saved value applies only when the drag ends, so a
	// text-size change can't resize the slider under the finger mid-drag.
	let dragging = $state<number | null>(null);
	const shown = $derived(dragging ?? value);
</script>

<!-- A setting with a continuous size (Trevor, 2026-10-16: granular sliders, not S/M/L). -->
<SettingRow {label} {description}>
	{#snippet control(labelId)}
		<div class="slider">
			<input
				type="range"
				aria-labelledby={labelId}
				aria-valuetext={format(shown)}
				{min}
				{max}
				{step}
				value={shown}
				oninput={(event) => (dragging = Number(event.currentTarget.value))}
				onchange={(event) => {
					dragging = null;
					onChange(Number(event.currentTarget.value));
				}}
			/>
			<output aria-hidden="true">{format(shown)}</output>
			<Button
				variant="quiet"
				icon="undo"
				disabled={Math.abs(value - defaultValue) < step / 2}
				onclick={() => onChange(defaultValue)}
			>
				{resetLabel}
			</Button>
		</div>
	{/snippet}
</SettingRow>

<style>
	.slider {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
	}
	input {
		flex: 1 1 calc(12 * var(--u));
		min-width: 0;
		min-height: var(--tap-target);
		margin: 0;
		accent-color: var(--accent);
		cursor: pointer;
	}
	input:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	/* Fixed width, so the value changing never moves the Reset button. */
	output {
		flex: none;
		min-width: 5ch;
		text-align: end;
		font-variant-numeric: tabular-nums;
	}
</style>

<script lang="ts">
	import SettingRow from './SettingRow.svelte';

	interface Props {
		label: string;
		description?: string;
		/** The saved value, e.g. 1.25 for 125%. */
		value: number;
		min: number;
		max: number;
		step: number;
		/** The default; gives the label a reset icon (Trevor, 2026-10-16: an icon, not a button). */
		defaultValue?: number;
		/** @deprecated The reset icon is labelled from the setting's name; ignored. */
		resetLabel?: string;
		/** How the value reads beside the slider; a whole percentage by default. */
		format?: (value: number) => string;
		/** Called as the slider moves (at most once a frame), so the change shows while dragging. */
		onChange: (value: number) => void;
	}

	// `resetLabel` stays accepted until TokenAppearanceSettings drops it.
	// eslint-disable-next-line svelte/no-unused-props
	let {
		label,
		description,
		value,
		min,
		max,
		step,
		defaultValue,
		format = (v) => `${Math.round(v * 100)}%`,
		onChange
	}: Props = $props();

	// Applies the size live while dragging (Trevor: show the change as it happens), at most
	// once per animation frame so a fast drag doesn't restyle the page more than it can paint.
	let next: number | null = null;
	let frame = 0;

	function move(raw: number) {
		next = raw;
		if (frame) return;
		frame = requestAnimationFrame(() => {
			frame = 0;
			if (next !== null && next !== value) onChange(next);
			next = null;
		});
	}
</script>

<!-- A setting with a continuous size (Trevor, 2026-10-16: granular sliders, not S/M/L). -->
<SettingRow
	{label}
	{description}
	onReset={defaultValue === undefined ? undefined : () => onChange(defaultValue)}
	isDefault={defaultValue !== undefined && Math.abs(value - defaultValue) < step / 2}
>
	{#snippet control(labelId)}
		<div class="slider">
			<input
				type="range"
				aria-labelledby={labelId}
				aria-valuetext={format(value)}
				{min}
				{max}
				{step}
				{value}
				oninput={(event) => move(Number(event.currentTarget.value))}
			/>
			<!-- Fixed width, so the number changing never moves the slider. -->
			<output aria-hidden="true">{format(value)}</output>
		</div>
	{/snippet}
</SettingRow>

<style>
	.slider {
		display: flex;
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
	output {
		flex: none;
		min-width: 5ch;
		text-align: end;
		font-variant-numeric: tabular-nums;
	}
</style>

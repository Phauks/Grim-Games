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
		/** How the value reads beside the slider; a whole percentage by default. */
		format?: (value: number) => string;
		/** Shown but unusable, e.g. a strength while its effect is off (no reflow). */
		disabled?: boolean;
		/** Called as the slider moves (at most once a frame), so the change shows while dragging. */
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
		format = (v) => `${Math.round(v * 100)}%`,
		disabled = false,
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

<!-- A setting with a continuous size (Trevor, 2026-10-16: granular sliders, not S/M/L), right
     of its name on every screen (Trevor, 2026-10-18). -->
<SettingRow
	layout="inline"
	{label}
	{description}
	onReset={defaultValue === undefined ? undefined : () => onChange(defaultValue)}
	isDefault={disabled || (defaultValue !== undefined && Math.abs(value - defaultValue) < step / 2)}
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
				{disabled}
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
		flex: 1;
		width: 100%;
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
	input:disabled {
		opacity: 0.4;
		cursor: default;
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

<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';

	interface Props {
		label: string;
		/** The colour in use, as #rrggbb. */
		value: string;
		/** Set when the colour is the person's own; gives the reset icon something to do. */
		custom: boolean;
		onChange: (value: string) => void;
		onReset: () => void;
		/** Low-contrast pairs this colour is part of, said in full; empty when fine. */
		warnings?: string[];
	}

	let { label, value, custom, onChange, onReset, warnings = [] }: Props = $props();
	const id = $props.id();
</script>

<!-- One colour on one line: its name and reset, a contrast warning slot that is always there
     (so nothing moves), and the swatch that opens the colour picker (Trevor, 2026-10-18). -->
<div class="color" data-setting data-search-label={label}>
	<label class="label" for="{id}-input">{label}</label>
	<button
		class="reset"
		type="button"
		aria-label={t('settings.resetToDefault')}
		title={t('settings.resetToDefault')}
		aria-describedby="{id}-input"
		disabled={!custom}
		onclick={onReset}><Icon name="reset" /></button
	>
	<button
		class="warning"
		type="button"
		hidden={warnings.length === 0}
		aria-label={t('settings.colorLowContrast')}
		title={warnings.join('\n')}
		onclick={() => toast(t('settings.colorLowContrast'), warnings.join(' '))}
		><Icon name="warning" /></button
	>
	<input
		id="{id}-input"
		type="color"
		{value}
		oninput={(event) => onChange(event.currentTarget.value)}
	/>
</div>

<style>
	.color {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto auto;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
	}
	/* The same name as every other setting (Trevor, 2026-10-24). */
	.label {
		font-family: var(--font-control);
		font-weight: var(--font-control-weight);
		color: var(--heading);
		letter-spacing: 0.03em;
		overflow-wrap: anywhere;
	}
	.reset,
	.warning {
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		padding: 0;
		border: 0;
		border-radius: var(--radius-full);
		background: none;
		color: var(--heading);
		cursor: pointer;
	}
	.reset:disabled {
		opacity: 0.35;
		cursor: default;
	}
	/* Hidden keeps its place, so a warning appearing moves nothing. */
	.warning[hidden] {
		display: grid;
		visibility: hidden;
	}
	.warning {
		color: var(--evil-text);
	}
	input {
		width: calc(2 * var(--tap-target));
		height: var(--tap-target);
		padding: var(--space-1);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--choice-background);
		cursor: pointer;
	}
	.reset:focus-visible,
	.warning:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
</style>

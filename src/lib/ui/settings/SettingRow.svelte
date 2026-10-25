<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';

	interface Props {
		label: string;
		description?: string;
		/** The control; label it with `aria-labelledby={labelId}`. */
		control: Snippet<[labelId: string]>;
		/** Puts a reset icon beside the label that sets the default back (Trevor, 2026-10-16). */
		onReset?: () => void;
		/** Already at the default: the reset icon stays in place, disabled, so nothing moves. */
		isDefault?: boolean;
		/**
		 * `inline` (default): the control sits right of the name, wrapping under it only when
		 * the row is too narrow (Trevor, 2026-10-18). `stacked`: under it, for wide controls
		 * such as option cards or tables. `inline-wide`: inline only where there is room for a
		 * long control (sliders), stacked on phones.
		 */
		layout?: 'inline' | 'inline-wide' | 'stacked';
		/**
		 * A setting that turns other things off: a warning mark after the name, seen before the
		 * control is touched, whose tap says what it costs (Trevor, 2026-10-23).
		 */
		warning?: string;
	}

	let {
		label,
		description,
		control,
		onReset,
		isDefault = false,
		layout = 'inline',
		warning
	}: Props = $props();
	const labelId = $props.id();
</script>

<!-- One setting: a visible label, an optional hint and its control. Rows are divided by a
     thin line (Trevor, 2026-10-18). -->
<div class="row" data-layout={layout}>
	<div class="grid">
		<div class="head">
			<span class="label" id={labelId}>{label}</span>
			{#if warning}
				<button
					class="reset warning"
					type="button"
					aria-label={t('settings.warning')}
					title={warning}
					aria-describedby={labelId}
					onclick={() => toast(label, warning)}><Icon name="warning" /></button
				>
			{/if}
			{#if onReset}
				<button
					class="reset"
					type="button"
					aria-label={t('settings.resetToDefault')}
					title={t('settings.resetToDefault')}
					aria-describedby={labelId}
					disabled={isDefault}
					onclick={onReset}><Icon name="reset" /></button
				>
			{/if}
		</div>
		{#if description}<p class="description">{description}</p>{/if}
		<div class="control">{@render control(labelId)}</div>
	</div>
</div>

<style>
	.row {
		container-type: inline-size;
		padding-block: var(--space-3);
	}
	/* A thin line between settings, whatever kind of row comes before. */
	:global(.row) + .row {
		border-top: 1px solid var(--border);
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-areas: 'head' 'description' 'control';
	}
	/* Name and hint on the left, the control on the right, when there is room. */
	@container (min-width: 30rem) {
		.row[data-layout='inline-wide'] .grid {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			grid-template-areas: 'head control' 'description control';
			column-gap: var(--space-4);
			align-items: center;
		}
		.row[data-layout='inline-wide'] .control {
			margin-top: 0;
		}
	}
	@container (min-width: 20rem) {
		.row[data-layout='inline'] .grid {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			grid-template-areas: 'head control' 'description control';
			column-gap: var(--space-4);
			align-items: center;
		}
		.row[data-layout='inline'] .control {
			margin-top: 0;
			display: flex;
			justify-content: flex-end;
		}
		/* A drop-down fills its half, so a longer choice never resizes it. */
		.row[data-layout='inline'] .control > :global([data-scope='select'][data-part='root']) {
			flex: 1;
		}
	}
	.head {
		grid-area: head;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	/* Margins, not a row gap, so a row without a hint has no empty gap. */
	.control {
		grid-area: control;
		min-width: 0;
		margin-top: var(--space-2);
	}
	.control > :global(*) {
		min-width: 0;
		max-width: 100%;
	}
	.label {
		font-family: var(--font-control);
		font-weight: var(--font-control-weight);
		color: var(--heading);
		letter-spacing: 0.03em;
	}
	/* The label's own size and colour (Trevor, 2026-10-16), with an invisible full-size tap
	   area around it so it stays easy to hit. */
	.reset {
		position: relative;
		display: inline-grid;
		place-items: center;
		width: 1em;
		height: 1em;
		padding: 0;
		border: 0;
		background: none;
		color: var(--heading);
		font-size: inherit;
		cursor: pointer;
	}
	.reset::before {
		content: '';
		position: absolute;
		inset: calc((1em - var(--tap-target)) / 2);
	}
	.reset :global(.icon) {
		width: 1em;
		height: 1em;
	}
	.warning {
		color: var(--evil);
	}
	.reset:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.reset:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.description {
		grid-area: description;
		margin: var(--space-1) 0 0;
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
</style>

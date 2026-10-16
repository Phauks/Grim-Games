<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';

	interface Props {
		label: string;
		description?: string;
		/** The control; label it with `aria-labelledby={labelId}`. */
		control: Snippet<[labelId: string]>;
		/** Puts a reset icon beside the label that sets the default back (Trevor, 2026-10-16). */
		onReset?: () => void;
		/** Already at the default: the reset icon stays in place, disabled, so nothing moves. */
		isDefault?: boolean;
	}

	let { label, description, control, onReset, isDefault = false }: Props = $props();
	const labelId = $props.id();
</script>

<!-- One setting: a visible label, an optional hint and its control, stacked for touch. -->
<div class="row">
	<div class="head">
		<span class="label" id={labelId}>{label}</span>
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
	{@render control(labelId)}
</div>

<style>
	.row + :global(.row) {
		margin-top: var(--space-5);
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
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
	.reset:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.reset:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.description {
		margin: calc(-1 * var(--space-1)) 0 var(--space-2);
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
</style>

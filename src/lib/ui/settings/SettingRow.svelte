<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';

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
			<span class="reset">
				<IconButton
					icon="reset"
					label={t('settings.resetToDefault')}
					aria-describedby={labelId}
					disabled={isDefault}
					onclick={onReset}
				/>
			</span>
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
		gap: var(--space-1);
		margin-bottom: var(--space-2);
	}
	.label {
		font-family: var(--font-control);
		font-weight: var(--font-control-weight);
		color: var(--heading);
		letter-spacing: 0.03em;
	}
	/* A full tap target centred on the label's line without making the line taller. */
	.reset {
		display: flex;
		align-items: center;
		height: 0;
		color: var(--on-surface-muted);
	}
	.reset :global(.icon-button) {
		color: inherit;
	}
	.reset :global(.icon-button:disabled) {
		opacity: 0.35;
	}
	.description {
		margin: calc(-1 * var(--space-1)) 0 var(--space-2);
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
</style>

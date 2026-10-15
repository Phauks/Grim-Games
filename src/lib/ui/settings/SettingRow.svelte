<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label: string;
		description?: string;
		/** The control; label it with `aria-labelledby={labelId}`. */
		control: Snippet<[labelId: string]>;
	}

	let { label, description, control }: Props = $props();
	const labelId = $props.id();
</script>

<!-- One setting: a visible label, an optional hint and its control, stacked for touch. -->
<div class="row">
	<span class="label" id={labelId}>{label}</span>
	{#if description}<p class="description">{description}</p>{/if}
	{@render control(labelId)}
</div>

<style>
	.row + :global(.row) {
		margin-top: var(--space-5);
	}
	.label {
		display: block;
		margin-bottom: var(--space-2);
		font-family: var(--font-control);
		font-weight: var(--font-control-weight);
		color: var(--heading);
		letter-spacing: 0.03em;
	}
	.description {
		margin: calc(-1 * var(--space-1)) 0 var(--space-2);
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
</style>

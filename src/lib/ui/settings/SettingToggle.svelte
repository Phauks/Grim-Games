<script lang="ts">
	import Toggle from '#lib/ui/primitives/Toggle.svelte';

	interface Props {
		label: string;
		description?: string;
		checked: boolean;
		onChange: (checked: boolean) => void;
		disabled?: boolean;
	}

	let { description, ...toggle }: Props = $props();
</script>

<!-- An on/off setting; the switch carries its own label so the row is one tap target. -->
<div
	class="row"
	data-setting
	data-search-label={toggle.label}
	data-search-description={description}
>
	<Toggle {...toggle} />
	{#if description}<p class="description">{description}</p>{/if}
</div>

<style>
	.row {
		padding-block: var(--space-3);
	}
	/* The same name as every other setting (Trevor, 2026-10-24), not plain text. */
	.row :global([data-scope='switch'][data-part='label']) {
		font-weight: var(--font-control-weight);
		color: var(--heading);
		letter-spacing: 0.03em;
	}
	.description {
		margin: 0;
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
</style>

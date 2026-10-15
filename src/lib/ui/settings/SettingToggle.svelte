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
<div class="row">
	<Toggle {...toggle} />
	{#if description}<p class="description">{description}</p>{/if}
</div>

<style>
	.row + :global(.row) {
		margin-top: var(--space-5);
	}
	.description {
		margin: 0;
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
</style>

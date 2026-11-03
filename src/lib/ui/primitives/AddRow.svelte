<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon from '#lib/ui/icons/Icon.svelte';

	/**
	 * The dashed "+ New" row at the end of a list (Trevor, 2026-10-23: "+ New" is a dashed
	 * card): a dashed edge, no fill, the full width. Notes' "+ New note" and the room vote's
	 * "+ New choice".
	 */
	interface Props extends Omit<HTMLButtonAttributes, 'children'> {
		label: string;
	}

	let { label, ...rest }: Props = $props();
</script>

<button type="button" class="add-row" {...rest}><Icon name="add" />{label}</button>

<style>
	.add-row {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		width: 100%;
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px dashed var(--border);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--on-surface-muted);
		font: inherit;
		font-family: var(--font-control);
		font-weight: 600;
		cursor: pointer;
		touch-action: manipulation;
	}
	.add-row:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>

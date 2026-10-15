<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { IconSlot } from '#lib/ui/icons/catalogue.ts';

	interface Props extends HTMLButtonAttributes {
		icon: IconSlot;
		/** Accessible name; also shown as a tooltip on hover. */
		label: string;
	}

	let { icon, label, ...rest }: Props = $props();
</script>

<button class="icon-button" type="button" aria-label={label} title={label} {...rest}>
	<Icon name={icon} />
</button>

<style>
	.icon-button {
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		padding: 0;
		border: 0;
		border-radius: var(--radius-full);
		background: none;
		color: var(--on-surface);
		cursor: pointer;
	}
	.icon-button:active {
		background: var(--surface-selected);
	}
	.icon-button:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>

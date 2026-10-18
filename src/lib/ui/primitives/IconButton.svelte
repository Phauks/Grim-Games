<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { IconSlot } from '#lib/ui/icons/catalogue.ts';

	interface Props extends HTMLButtonAttributes {
		icon: IconSlot;
		/** Accessible name; also shown as a tooltip on hover. */
		label: string;
		/** The button element, e.g. to anchor a popover. */
		ref?: HTMLButtonElement;
		/** Drawn instead of `icon`, e.g. the account's own profile icon. */
		face?: Snippet;
	}

	let { icon, label, ref = $bindable(), face, ...rest }: Props = $props();
</script>

<button
	bind:this={ref}
	class="icon-button"
	type="button"
	aria-label={label}
	title={label}
	{...rest}
>
	{#if face}{@render face()}{:else}<Icon name={icon} />{/if}
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
	/* A switch (aria-pressed), when on. */
	.icon-button[aria-pressed='true'] {
		background: var(--surface-selected);
		box-shadow: inset 0 0 0 2px var(--accent);
	}
	.icon-button:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>

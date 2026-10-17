<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon from '#lib/ui/icons/Icon.svelte';

	/**
	 * Every delete, remove or clear is this red trash can, never a text button (Trevor,
	 * 2026-10-17: "Can we please lint so all deletes are just that way"). The label is its
	 * accessible name and tooltip ("Delete note", "Remove from game"). Anything that can't be
	 * undone still asks first, in a ConfirmDialog. The lint `grim/delete-button` sends every
	 * Delete, Remove or Clear button here.
	 */
	interface Props extends HTMLButtonAttributes {
		/** What it deletes, said in full: the accessible name and tooltip. */
		label: string;
	}

	let { label, ...rest }: Props = $props();
</script>

<button class="delete" type="button" aria-label={label} title={label} {...rest}>
	<Icon name="remove" />
</button>

<style>
	.delete {
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		padding: 0;
		border: 0;
		border-radius: var(--radius-full);
		background: none;
		color: var(--evil);
		cursor: pointer;
	}
	.delete:active,
	.delete:hover:not(:disabled) {
		background: var(--surface-selected);
	}
	.delete:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>

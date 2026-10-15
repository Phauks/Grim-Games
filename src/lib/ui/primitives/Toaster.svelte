<script lang="ts">
	import { Toast, Toaster } from '@ark-ui/svelte/toast';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { toaster } from './toaster.ts';
</script>

<Toaster {toaster}>
	{#snippet children(toast)}
		<Toast.Root>
			<div class="text">
				<Toast.Title>{toast().title}</Toast.Title>
				{#if toast().description}<Toast.Description>{toast().description}</Toast.Description>{/if}
			</div>
			<Toast.CloseTrigger aria-label="Dismiss"><Icon name="close" /></Toast.CloseTrigger>
		</Toast.Root>
	{/snippet}
</Toaster>

<style>
	:global([data-scope='toast'][data-part='group']) {
		z-index: var(--z-toast);
	}
	:global([data-scope='toast'][data-part='root']) {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: min(calc(100vw - 2 * var(--space-4)), 24rem);
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
		border-radius: var(--card-radius);
		background: var(--toast-background);
		color: var(--toast-color);
		box-shadow: var(--shadow);
		translate: var(--x) var(--y);
		scale: var(--scale);
		z-index: var(--z-index);
		height: var(--height);
		opacity: var(--opacity);
		will-change: translate, opacity, scale;
		transition:
			translate var(--duration-normal),
			scale var(--duration-normal),
			opacity var(--duration-normal),
			height var(--duration-normal);
	}
	:global([data-scope='toast'][data-part='title']) {
		font-weight: 600;
	}
	:global([data-scope='toast'][data-part='close-trigger']) {
		display: grid;
		place-items: center;
		min-width: var(--tap-target);
		margin-left: auto;
		border: 0;
		background: none;
	}
	.text {
		flex: 1;
		padding: var(--space-2) 0;
	}
</style>

<script lang="ts">
	import { Dialog } from '@ark-ui/svelte/dialog';
	import { Portal } from '@ark-ui/svelte/portal';
	import type { Snippet } from 'svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';

	interface Props {
		open?: boolean;
		title: string;
		description?: string;
		/** Use `alertdialog` for confirmations that interrupt the user. */
		role?: 'dialog' | 'alertdialog';
		/** `full` fills a phone screen and becomes a large panel on wider screens. */
		size?: 'normal' | 'full';
		children: Snippet;
		actions?: Snippet;
	}

	let {
		open = $bindable(false),
		title,
		description,
		role = 'dialog',
		size = 'normal',
		children,
		actions
	}: Props = $props();
</script>

<Dialog.Root bind:open {role} lazyMount unmountOnExit>
	<Portal>
		<Dialog.Backdrop />
		<Dialog.Positioner>
			<Dialog.Content data-size={size}>
				<div class="head">
					<Dialog.Title>{title}</Dialog.Title>
					<Dialog.CloseTrigger aria-label="Close"><Icon name="close" /></Dialog.CloseTrigger>
				</div>
				{#if description}<Dialog.Description>{description}</Dialog.Description>{/if}
				{@render children()}
				{#if actions}<div class="actions">{@render actions()}</div>{/if}
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog.Root>

<style>
	:global([data-scope='dialog'][data-part='backdrop']) {
		position: fixed;
		inset: 0;
		z-index: var(--z-backdrop);
		background: var(--backdrop);
	}
	:global([data-scope='dialog'][data-part='positioner']) {
		position: fixed;
		inset: 0;
		z-index: var(--z-dialog);
		display: grid;
		place-items: center;
		padding: var(--space-4);
	}
	:global([data-scope='dialog'][data-part='content']) {
		width: min(100%, calc(28 * var(--u)));
		max-height: 85dvh;
		overflow-y: auto;
		padding: var(--space-4);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--dialog-background);
		color: var(--dialog-color);
		box-shadow: var(--shadow);
	}
	:global([data-scope='dialog'][data-part='content'][data-size='full']) {
		display: flex;
		flex-direction: column;
		width: min(100%, calc(56 * var(--u)));
		height: min(100%, calc(46 * var(--u)));
		max-height: none;
		overflow: hidden;
	}
	@media (max-width: 40rem) {
		:global([data-scope='dialog'][data-part='positioner']:has([data-size='full'])) {
			padding: 0;
		}
		:global([data-scope='dialog'][data-part='content'][data-size='full']) {
			width: 100%;
			height: 100%;
			border: 0;
			border-radius: 0;
			padding-top: calc(var(--space-4) + env(safe-area-inset-top));
		}
	}
	:global([data-scope='dialog'][data-state='open']) {
		animation: dialog-in var(--duration-normal) var(--ease-out);
	}
	:global([data-scope='dialog'][data-state='closed']) {
		animation: dialog-out var(--duration-fast) var(--ease-in) forwards;
	}
	:global([data-scope='dialog'][data-part='title']) {
		margin: 0;
		font-family: var(--font-display);
		font-weight: var(--font-display-weight);
		font-size: 1.25rem;
		color: var(--heading);
	}
	:global([data-scope='dialog'][data-part='close-trigger']) {
		display: grid;
		place-items: center;
		min-width: var(--tap-target);
		border: 0;
		background: none;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}

	@keyframes -global-dialog-in {
		from {
			opacity: 0;
		}
	}
	@keyframes -global-dialog-out {
		to {
			opacity: 0;
		}
	}
</style>

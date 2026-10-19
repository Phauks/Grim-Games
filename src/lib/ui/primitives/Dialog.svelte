<script lang="ts">
	import { Dialog } from '@ark-ui/svelte/dialog';
	import { Portal } from '@ark-ui/svelte/portal';
	import type { Snippet } from 'svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { layerStyle, openLayer } from './layers.ts';

	interface Props {
		open?: boolean;
		title: string;
		description?: string;
		/** Use `alertdialog` for confirmations that interrupt the user. */
		role?: 'dialog' | 'alertdialog';
		/**
		 * `full` fills a phone screen and becomes a large panel on wider screens; `max` fills
		 * a phone screen and nearly all of a wider one (the day sheet, Trevor 2026-10-16);
		 * `side` is a full-height panel sliding in from the left edge (the navigation drawer).
		 */
		size?: 'normal' | 'full' | 'max' | 'side';
		children: Snippet;
		actions?: Snippet;
		/** Shown before the title, e.g. a character badge for the seat a menu acts on. */
		lead?: Snippet;
		/** Replaces the title's text, e.g. with a reminder token (names show as badges). */
		heading?: Snippet;
		/** Replaces the description's text, e.g. with a character badge. */
		subtitle?: Snippet;
		/** Extra icon buttons in the header, just before Close (e.g. "Open wiki"). */
		headActions?: Snippet;
		/** False hides the ✕, for a dialog whose `lead` already closes it (the menu drawer). */
		closeButton?: boolean;
		/**
		 * A `full` or `max` dialog scrolls its content under a fixed header. False for content
		 * that fills the space and handles its own scrolling or panning (the scratch pad).
		 */
		scroll?: boolean;
		/**
		 * Asked when ✕, Escape or a tap outside would close it; false keeps it open (a form
		 * with unsaved changes asks first).
		 */
		beforeClose?: () => boolean;
	}

	let {
		open = $bindable(false),
		title,
		description,
		role = 'dialog',
		size = 'normal',
		children,
		actions,
		lead,
		heading,
		subtitle,
		headActions,
		closeButton = true,
		scroll = true,
		beforeClose
	}: Props = $props();

	// Drawn above every overlay opened before it (layers.ts); kept after closing so the exit
	// animation stays where it was.
	let layer = $state(1);
	$effect(() => {
		if (!open) return;
		const taken = openLayer();
		layer = taken.layer;
		return taken.close;
	});

	/**
	 * The overlay under this one closed. Zag would close this one from inside that close, with
	 * a flushSync that crashes Svelte 5.57 (null batch), so close it just after, through `open`.
	 */
	function dismissedByParent(event: { preventDefault(): void }) {
		event.preventDefault();
		queueMicrotask(() => (open = false));
	}

	/** Keeps the dialog open when `beforeClose` says no. */
	function guard(event: { preventDefault(): void }) {
		if (beforeClose?.() === false) event.preventDefault();
	}
</script>

<Dialog.Root
	bind:open
	{role}
	lazyMount
	unmountOnExit
	onEscapeKeyDown={guard}
	onInteractOutside={guard}
	onRequestDismiss={dismissedByParent}
>
	<Portal>
		<Dialog.Backdrop style={layerStyle(layer, 'backdrop')} />
		<Dialog.Positioner style={layerStyle(layer, 'content')}>
			<Dialog.Content data-size={size}>
				<div class="head">
					<div class="titled" class:with-lead={!!lead}>
						{#if lead}<span class="lead">{@render lead()}</span>{/if}
						<Dialog.Title
							>{#if heading}{@render heading()}{:else}{title}{/if}</Dialog.Title
						>
					</div>
					{#if headActions}<span class="head-actions">{@render headActions()}</span>{/if}
					{#if closeButton}
						<!-- A plain button that sets `open`, not Ark's CloseTrigger: zag's own close runs a
						     flushSync that can crash Svelte 5.57 (null batch) about one close in three. -->
						<button
							type="button"
							data-scope="dialog"
							data-part="close-trigger"
							aria-label="Close"
							onclick={() => {
								if (beforeClose?.() !== false) open = false;
							}}><Icon name="close" /></button
						>
					{/if}
				</div>
				{#if subtitle}<Dialog.Description>{@render subtitle()}</Dialog.Description
					>{:else if description}<Dialog.Description>{description}</Dialog.Description>{/if}
				{#if size === 'full' || size === 'max'}
					<div class="body" data-scroll={scroll || undefined}>{@render children()}</div>
				{:else}
					{@render children()}
				{/if}
				{#if actions}<div class="actions">{@render actions()}</div>{/if}
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog.Root>

<style>
	:global([data-scope='dialog'][data-part='backdrop']) {
		position: fixed;
		inset: 0;
		z-index: calc(var(--z-overlay) + var(--layer, 0));
		background: var(--backdrop);
	}
	:global([data-scope='dialog'][data-part='positioner']) {
		position: fixed;
		inset: 0;
		z-index: calc(var(--z-overlay) + var(--layer, 1));
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
	:global([data-scope='dialog'][data-part='content'][data-size='max']) {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		max-height: none;
		overflow: hidden;
	}
	@media (max-width: 40rem) {
		:global([data-scope='dialog'][data-part='positioner']:has([data-size='full'])),
		:global([data-scope='dialog'][data-part='positioner']:has([data-size='max'])) {
			padding: 0;
		}
		:global([data-scope='dialog'][data-part='content'][data-size='full']),
		:global([data-scope='dialog'][data-part='content'][data-size='max']) {
			width: 100%;
			height: 100%;
			border: 0;
			border-radius: 0;
			padding-top: calc(var(--space-4) + env(safe-area-inset-top));
		}
	}
	:global([data-scope='dialog'][data-part='positioner']:has([data-size='side'])) {
		place-items: stretch start;
		padding: 0;
	}
	:global([data-scope='dialog'][data-part='content'][data-size='side']) {
		width: min(85vw, calc(18 * var(--u)));
		max-height: none;
		height: 100%;
		border: 0;
		border-right: var(--card-border);
		border-radius: 0;
		padding-top: calc(var(--space-4) + env(safe-area-inset-top));
		padding-left: calc(var(--space-4) + env(safe-area-inset-left));
	}
	:global([data-scope='dialog'][data-part='content'][data-size='side'][data-state='open']) {
		animation: side-in var(--duration-normal) var(--ease-out);
	}
	:global([data-scope='dialog'][data-part='content'][data-size='side'][data-state='closed']) {
		animation: side-out var(--duration-fast) var(--ease-in) forwards;
	}
	:global([data-scope='dialog'][data-state='open']) {
		animation: dialog-in var(--duration-normal) var(--ease-out);
	}
	:global([data-scope='dialog'][data-state='closed']) {
		animation: dialog-out var(--duration-fast) var(--ease-in) forwards;
	}
	:global([data-scope='dialog'][data-part='title']) {
		margin: 0;
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
		font-size: 1.25rem;
		color: var(--heading);
	}
	:global([data-scope='dialog'][data-part='close-trigger']) {
		display: grid;
		place-items: center;
		flex: none;
		padding: 0;
		border: 0;
		/* Not `background: none`: that would reset the shared hover tint (base.css). */
		background-color: transparent;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.head-actions {
		flex: none;
		display: flex;
		align-items: center;
	}
	.titled {
		flex: 1;
		min-width: 0;
	}
	/*
	 * Beside a lead, the lead and the title share the room evenly, each up to its full width,
	 * so a short title stays on one line and a wide badge shrinks with its name ending in "…"
	 * (CharacterBadge's inline ellipsis). A large Names in text size no longer squeezes the
	 * title to a letter per line (Trevor, 2026-10-19). A row of flex items can't share that
	 * way without also shrinking the title.
	 */
	.titled.with-lead {
		display: grid;
		grid-template-columns: minmax(var(--tap-target), auto) minmax(min-content, max-content);
		justify-content: start;
		align-items: center;
		gap: var(--space-3);
	}
	.lead {
		display: flex;
		min-width: 0;
	}
	.lead > :global(.badge) {
		min-width: 0;
		max-width: 100%;
	}
	/*
	 * Full and max dialogs keep the header in place and scroll what is under it, so no caller
	 * has to build its own scroll area (two "can't scroll" bugs came from that, 2026-10-18).
	 * A caller's own `flex: 1` scroll area still fills the body as before.
	 */
	.body {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}
	.body[data-scroll] {
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	/* Bottom right, and in view at the bottom of a long dialog (Trevor, 2026-10-17). */
	.actions {
		--modal-actions-background: var(--dialog-background);
		position: sticky;
		bottom: calc(-1 * var(--space-4));
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-2);
		margin-top: var(--space-4);
		padding-bottom: var(--space-4);
		margin-bottom: calc(-1 * var(--space-4));
		background: var(--dialog-background);
	}
	.actions :global(.modal-actions) {
		position: static;
		padding-top: 0;
	}

	@keyframes -global-dialog-in {
		from {
			opacity: 0;
		}
	}
	@keyframes -global-side-in {
		from {
			transform: translateX(-100%);
		}
	}
	@keyframes -global-side-out {
		to {
			transform: translateX(-100%);
		}
	}
	@keyframes -global-dialog-out {
		to {
			opacity: 0;
		}
	}
</style>

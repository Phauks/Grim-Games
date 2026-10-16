<script lang="ts">
	import { Popover } from '@ark-ui/svelte/popover';
	import { Portal } from '@ark-ui/svelte/portal';
	import type { Snippet } from 'svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';

	interface Props {
		open?: boolean;
		title: string;
		/**
		 * The element the popover points at. Many small triggers can share one popover this
		 * way (a page of rules terms would otherwise mount hundreds); each trigger sets the
		 * anchor and opens it. Focus returns to the anchor on close.
		 */
		anchor?: HTMLElement;
		/** Taps on these elements do not dismiss it (another trigger that will switch it). */
		keepOpenOn?: (target: Element) => boolean;
		children: Snippet;
	}

	let { open = $bindable(false), title, anchor, keepOpenOn, children }: Props = $props();
</script>

<!--
	A small overlay anchored to an element: extra detail without moving the page.
	Tap outside, Escape or the close button dismisses it.
-->
<Popover.Root
	bind:open
	lazyMount
	unmountOnExit
	positioning={{
		placement: 'bottom',
		gutter: 6,
		overflowPadding: 12,
		flip: true,
		getAnchorElement: () => anchor ?? null
	}}
	finalFocusEl={() => anchor ?? null}
	onInteractOutside={(event) => {
		const target = event.detail.originalEvent.target;
		if (target instanceof Element && (anchor?.contains(target) || keepOpenOn?.(target))) {
			event.preventDefault();
		}
	}}
>
	<Portal>
		<Popover.Positioner>
			<Popover.Content aria-label={title}>
				<div class="head">
					<Popover.Title>{title}</Popover.Title>
					<Popover.CloseTrigger aria-label="Close"><Icon name="close" /></Popover.CloseTrigger>
				</div>
				{@render children()}
			</Popover.Content>
		</Popover.Positioner>
	</Portal>
</Popover.Root>

<style>
	:global([data-scope='popover'][data-part='content']) {
		position: relative;
		z-index: var(--z-popover);
		width: min(20rem, calc(100vw - 2 * var(--space-4)));
		/* Never taller than the room beside its anchor (Ark sets --available-height). */
		max-height: var(--available-height, none);
		overflow-y: auto;
		padding: var(--space-2) var(--space-3) var(--space-3);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--dialog-background);
		color: var(--dialog-color);
		box-shadow: var(--shadow);
		font-size: 0.95rem;
		line-height: 1.4;
		text-align: start;
		text-transform: none;
		letter-spacing: normal;
	}
	:global([data-scope='popover'][data-part='content'][data-state='open']) {
		animation: popover-in var(--duration-fast) var(--ease-out);
	}
	:global([data-scope='popover'][data-part='title']) {
		margin: 0;
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
		font-size: 1.1rem;
		color: var(--heading);
	}
	:global([data-scope='popover'][data-part='close-trigger']) {
		display: grid;
		place-items: center;
		flex: none;
		width: var(--tap-target);
		height: var(--tap-target);
		margin-right: calc(var(--space-2) * -1);
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
		--icon-size: 1.25rem;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	@keyframes -global-popover-in {
		from {
			opacity: 0;
		}
	}
</style>

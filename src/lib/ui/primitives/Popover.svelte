<script lang="ts">
	import { Popover } from '@ark-ui/svelte/popover';
	import { Portal } from '@ark-ui/svelte/portal';
	import type { Snippet } from 'svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';

	interface Props {
		open?: boolean;
		title: string;
		/** Class for the trigger button, which callers style (an inline term, a chip, ...). */
		triggerClass?: string;
		/** Accessible name of the trigger when its content alone is not enough. */
		triggerLabel?: string;
		/** What the trigger shows. */
		trigger: Snippet;
		children: Snippet;
	}

	let {
		open = $bindable(false),
		title,
		triggerClass,
		triggerLabel,
		trigger,
		children
	}: Props = $props();
</script>

<!--
	A small overlay anchored to its trigger: extra detail without moving the page.
	Tap outside, Escape or the close button dismisses it.
-->
<Popover.Root
	bind:open
	lazyMount
	unmountOnExit
	positioning={{ placement: 'bottom', gutter: 6, overflowPadding: 12, flip: true }}
>
	<Popover.Trigger class={triggerClass} aria-label={triggerLabel}
		>{@render trigger()}</Popover.Trigger
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
		font-family: var(--font-display);
		font-weight: var(--font-display-weight);
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

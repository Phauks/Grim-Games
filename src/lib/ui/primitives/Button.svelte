<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import type { ResolvedPathname } from '$app/types';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { IconSlot } from '#lib/ui/icons/catalogue.ts';

	interface Props extends HTMLButtonAttributes {
		icon?: IconSlot;
		/** Renders a link styled as a button; pass a path from `resolve()` in `$app/paths`. */
		href?: ResolvedPathname;
		/** `accent` is the one main action in a group (e.g. Refresh). */
		/**
		 * `danger` marks a destructive action: a red fill, with the text colour of every other
		 * button (Trevor, 2026-10-16; 2026-10-22: red text on a dark menu was hard to read).
		 */
		/**
		 * `field` opens a picker (Special rules, Restricted characters) and looks like the
		 * drop-downs and chips beside it (Trevor, 2026-10-19: it "looks different from other
		 * button on page").
		 */
		variant?: 'solid' | 'quiet' | 'accent' | 'danger' | 'field';
		children: Snippet;
	}

	let { icon, href, variant = 'solid', children, ...rest }: Props = $props();
</script>

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href is already resolved -->
	<a class="button" data-variant={variant} {href}>
		{#if icon}<Icon name={icon} />{/if}
		<span>{@render children()}</span>
	</a>
{:else}
	<button class="button" data-variant={variant} type="button" {...rest}>
		{#if icon}<Icon name={icon} />{/if}
		<span>{@render children()}</span>
	</button>
{/if}

<style>
	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: 0 var(--space-4);
		border: 0;
		border-radius: var(--button-radius);
		background: var(--button-background);
		color: var(--button-color);
		/* An edge on every surface, so no button blends into what's behind it. */
		box-shadow: var(--button-ring);
		font: var(--button-font);
		letter-spacing: 0.04em;
		text-decoration: none;
		cursor: pointer;
	}
	.button[data-variant='quiet'] {
		background: transparent;
		color: inherit;
	}
	/* The drop-down trigger's look (Select.svelte), label at the start. */
	.button[data-variant='field'] {
		justify-content: flex-start;
		padding: var(--space-1) var(--space-3);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--choice-background);
		color: var(--choice-color);
		box-shadow: none;
		font-family: var(--font-control);
		text-align: left;
	}
	.button[data-variant='danger'] {
		background: var(--danger);
		box-shadow: inset 0 0 0 1px var(--danger-edge);
	}
	.button:hover {
		filter: brightness(1.15);
	}
	.button[data-variant='accent'] {
		background: var(--accent);
		color: var(--on-accent);
		box-shadow: inset 0 0 0 1px var(--accent-edge);
	}
	.button[data-variant='quiet']:hover {
		filter: none;
		/* A wash of the button's own text colour, so the label reads on any surface and in any
		   theme (Trevor, 2026-10-18: a hovered Cancel was hard to read on a sheet). */
		background: var(--surface-hover);
	}
	.button:disabled {
		cursor: default;
		opacity: 0.5;
		filter: none;
	}
	.button:active {
		transform: translateY(1px);
	}
</style>

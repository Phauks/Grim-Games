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
		/** `danger` and `danger-quiet` mark a destructive action in red (Trevor, 2026-10-16). */
		variant?: 'solid' | 'quiet' | 'accent' | 'danger' | 'danger-quiet';
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
		font: var(--button-font);
		letter-spacing: 0.04em;
		text-decoration: none;
		cursor: pointer;
	}
	.button[data-variant='quiet'] {
		background: transparent;
		color: inherit;
		box-shadow: inset 0 0 0 1px var(--border);
	}
	.button[data-variant='danger'] {
		background: var(--evil);
		color: var(--on-evil);
	}
	.button[data-variant='danger-quiet'] {
		background: transparent;
		color: var(--evil);
		box-shadow: inset 0 0 0 1px var(--evil);
	}
	.button:hover {
		filter: brightness(1.15);
	}
	.button[data-variant='accent'] {
		background: var(--accent);
		color: var(--on-accent);
	}
	.button[data-variant='quiet']:hover,
	.button[data-variant='danger-quiet']:hover {
		filter: none;
		background: var(--surface-selected, rgb(255 255 255 / 0.06));
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

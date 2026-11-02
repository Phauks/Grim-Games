<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
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
		/**
		 * An outside page (the wiki) opened in a new tab: drawn as a link with the same look and
		 * hover as every icon button, such as the dialog's X (Trevor, 2026-10-20).
		 */
		href?: string;
		/** The link's `rel`; `noopener` unless given (e.g. `noopener noreferrer`). */
		rel?: string;
		/** Drawn with the quiet Button's edge, so it reads as something to tap (Trevor, 2026-10-20). */
		outlined?: boolean;
		/**
		 * Words beside the icon, for the one button in a row that needs them to be understood
		 * (Show characters beside Players' ✕, Trevor 2026-10-31): the same height, edge and
		 * tint as the icons around it, as a pill.
		 */
		children?: Snippet;
	}

	let {
		icon,
		label,
		ref = $bindable(),
		face,
		href,
		rel = 'noopener',
		outlined = false,
		children,
		...rest
	}: Props = $props();
</script>

{#if href}
	<!-- External pages only, not app routes. -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		class="icon-button"
		data-outlined={outlined || undefined}
		{href}
		target="_blank"
		{rel}
		aria-label={label}
		title={label}
		{...rest as HTMLAnchorAttributes}
	>
		{#if face}{@render face()}{:else}<Icon name={icon} />{/if}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<button
		bind:this={ref}
		class="icon-button"
		data-outlined={outlined || undefined}
		data-text={children ? '' : undefined}
		type="button"
		aria-label={label}
		title={label}
		{...rest}
	>
		{#if face}{@render face()}{:else}<Icon name={icon} />{/if}
		{#if children}<span class="text">{@render children()}</span>{/if}
	</button>
{/if}

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
		text-decoration: none;
		cursor: pointer;
	}
	/* The quiet Button's edge and corners (Button.svelte). */
	.icon-button[data-outlined] {
		border-radius: var(--button-radius);
		box-shadow: var(--button-ring);
	}
	/* With words: a pill as tall as its neighbours, the icon first. */
	.icon-button[data-text] {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		width: auto;
		padding: 0 var(--space-3);
		border-radius: var(--radius-full);
		font: inherit;
		white-space: nowrap;
	}
	.icon-button:active {
		background: var(--surface-selected);
	}
	/* A menu or list it opens (aria-expanded), while open. */
	.icon-button[aria-expanded='true'] {
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

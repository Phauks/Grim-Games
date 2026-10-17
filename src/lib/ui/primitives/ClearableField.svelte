<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';

	/**
	 * Every single-line field people type into has an X that clears it (Trevor, 2026-10-16).
	 * Wraps the field's own `<input>`, which keeps its styles; bind the same value to both:
	 *
	 *     <ClearableField bind:value={query}><input type="search" bind:value={query} /></ClearableField>
	 *
	 * The X keeps its place and is disabled while the field is empty, so nothing moves as
	 * you type. In a search or filter (`type="search"`) Esc also clears, and a second Esc
	 * reaches the dialog or sheet; focus stays in the field. The lint `grim/clearable-field` sends every text, search, email, URL and phone
	 * input here; multi-line notes (textarea) are left alone.
	 */
	interface Props {
		value?: string | null;
		/** The field. */
		children: Snippet;
		/** Accessible name of the X; "Clear" by default. */
		label?: string;
		/** The field is disabled, so the X is too. */
		disabled?: boolean;
		/** Runs after the text is cleared. */
		onclear?: () => void;
		class?: string;
	}

	let {
		value = $bindable(''),
		children,
		label,
		disabled = false,
		onclear,
		class: className
	}: Props = $props();
	let root = $state<HTMLElement>();
	const empty = $derived(!value);

	function clear() {
		value = '';
		root?.querySelector('input')?.focus();
		onclear?.();
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || empty || disabled) return;
		// Only a search or filter: elsewhere Esc keeps closing the dialog, so it never wipes a
		// note's title or a name by surprise.
		if (!(event.target instanceof HTMLInputElement) || event.target.type !== 'search') return;
		// The first Esc clears; the next one reaches the dialog or sheet and closes it.
		event.preventDefault();
		event.stopPropagation();
		clear();
	}
</script>

<!-- Esc is handled here for the input inside. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<span class={['clearable', className]} bind:this={root} {onkeydown}>
	{@render children()}
	<button
		type="button"
		class="clear"
		aria-label={label ?? t('common.clear')}
		title={label ?? t('common.clear')}
		disabled={empty || disabled}
		onpointerdown={(event) => {
			// Keep focus in the field, so a field that saves on blur (a seat's name) stays open.
			event.preventDefault();
		}}
		onclick={clear}><Icon name="close" /></button
	>
</span>

<style>
	/* The field and its X share one cell: the X sits over the field's end. */
	.clearable {
		display: grid;
		grid-template-areas: 'field';
		align-items: center;
		min-width: 0;
		/* In a row (a search icon and its field), it takes the room the field took. */
		flex: 1 1 auto;
	}
	.clearable > :global(input) {
		grid-area: field;
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		/*
		 * Room for the X, so text never runs under it; important because a field's own
		 * padding shorthand would otherwise win.
		 */
		padding-inline-end: var(--tap-target) !important;
	}
	/* Our own X keeps its place; hide the browser's. */
	.clearable > :global(input::-webkit-search-cancel-button) {
		appearance: none;
	}
	.clear {
		grid-area: field;
		justify-self: end;
		/* As tall as the field, so a short field (a seat's name) keeps its height. */
		align-self: stretch;
		position: relative;
		display: grid;
		place-items: center;
		width: var(--tap-target);
		padding: 0;
		border: 0;
		border-radius: var(--radius-full);
		background: none;
		color: inherit;
		cursor: pointer;
	}
	/* The tap area reaches the 44px minimum without making the field taller. */
	.clear::before {
		content: '';
		position: absolute;
		inset: min(0%, calc((100% - var(--tap-target)) / 2)) 0;
	}
	.clear:hover:not(:disabled) {
		background: var(--surface-selected);
	}
	.clear:disabled {
		opacity: 0.35;
		cursor: default;
	}
</style>

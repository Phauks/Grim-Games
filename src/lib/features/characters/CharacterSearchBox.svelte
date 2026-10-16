<script lang="ts">
	import Icon from '#lib/ui/icons/Icon.svelte';

	interface Props {
		query: string;
		/** Accessible name of the box. */
		label?: string;
		/** On a computer, "/" anywhere on the page (outside a field or dialog) jumps to this box. */
		shortcut?: boolean;
	}

	let { query = $bindable(''), label = 'Search characters', shortcut = false }: Props = $props();
	let input = $state<HTMLInputElement>();

	function onWindowKey(event: KeyboardEvent) {
		if (!shortcut || event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return;
		if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
		event.preventDefault();
		input?.focus();
	}
</script>

<svelte:window onkeydown={onWindowKey} />

<!--
	The character search box. Fixed height; the clear button keeps its place (disabled when
	empty), so typing never moves anything. Enter closes the phone keyboard.
-->
<div class="search">
	<Icon name="search" />
	<input
		bind:this={input}
		bind:value={query}
		type="search"
		aria-label={label}
		placeholder="Search name or ability"
		aria-keyshortcuts={shortcut ? '/' : undefined}
		title={shortcut ? 'Search (press /)' : undefined}
		autocomplete="off"
		autocapitalize="off"
		spellcheck="false"
		enterkeyhint="search"
		onkeydown={(e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				e.currentTarget.blur();
			} else if (e.key === 'Escape' && query !== '') {
				// The first Esc clears the search; the next one reaches the sheet and closes it.
				e.preventDefault();
				e.stopPropagation();
				query = '';
			}
		}}
	/>
	<button
		type="button"
		class="clear"
		aria-label="Clear search"
		title="Clear search"
		disabled={query === ''}
		onclick={() => {
			query = '';
			input?.focus();
		}}><Icon name="close" /></button
	>
</div>

<style>
	.search {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		height: var(--tap-target);
		padding-inline-start: var(--space-2);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		box-shadow: inset 0 0 0 1px var(--border);
	}
	.search:focus-within {
		box-shadow: inset 0 0 0 2px var(--focus);
	}
	input {
		flex: 1;
		min-width: 0;
		height: 100%;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		outline: none;
	}
	/* Our own clear button keeps its place; hide the browser's. */
	input::-webkit-search-cancel-button {
		appearance: none;
	}
	.clear {
		display: grid;
		place-items: center;
		flex: none;
		width: var(--tap-target);
		height: var(--tap-target);
		border: 0;
		border-radius: var(--radius-full);
		background: none;
		color: inherit;
		cursor: pointer;
	}
	.clear:hover:not(:disabled) {
		background: var(--surface-selected);
	}
	.clear:disabled {
		opacity: 0.35;
		cursor: default;
	}
</style>

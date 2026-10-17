<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';

	interface Props {
		query: string;
		/** Accessible name of the box. */
		label?: string;
		/** On a computer, "/" anywhere on the page (outside a field or dialog) jumps to this box. */
		shortcut?: boolean;
	}

	let { query = $bindable(''), label = t('picker.search'), shortcut = false }: Props = $props();
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
	<ClearableField bind:value={query} label={t('picker.clearSearch')} class="box">
		<input
			bind:this={input}
			bind:value={query}
			type="search"
			aria-label={label}
			placeholder={t('picker.placeholder')}
			aria-keyshortcuts={shortcut ? '/' : undefined}
			title={shortcut ? t('picker.searchShortcut') : undefined}
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			enterkeyhint="search"
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					e.currentTarget.blur();
				}
			}}
		/>
	</ClearableField>
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
	/* The field's own rounded border shows focus; no second ring on the input. */
	.search input:focus-visible {
		outline: none;
	}
	.search > :global(.box) {
		flex: 1;
		height: 100%;
	}
	input {
		height: 100%;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		outline: none;
	}
</style>

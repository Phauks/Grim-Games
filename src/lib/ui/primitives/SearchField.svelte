<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import ClearableField from './ClearableField.svelte';

	/**
	 * The one search box (component review, 2026-10-18): a search icon, the field and its
	 * clear X in one rounded box. The label is read out but not shown; the icon carries it,
	 * so tapping the icon focuses the field. Esc clears (ClearableField), Enter closes a
	 * phone's keyboard. Seven features had their own copy of this box.
	 *
	 * `shortcut`: on a computer, "/" anywhere on the page (outside a field or dialog) jumps
	 * here. Give it to one box per page.
	 */
	interface Props {
		/** The field's accessible name. */
		label: string;
		value?: string;
		placeholder?: string;
		/** Accessible name of the clear X; "Clear" by default. */
		clearLabel?: string;
		/** "/" focuses the field. */
		shortcut?: boolean;
		/** Every keystroke, for a field shown from state it doesn't own (`value` without bind). */
		oninput?: (value: string) => void;
		/** Enter; the field blurs afterwards unless this returns false. */
		oncommit?: () => boolean | void;
		testid?: string;
		class?: string;
	}

	let {
		label,
		value = $bindable(''),
		placeholder,
		clearLabel,
		shortcut = false,
		oninput,
		oncommit,
		testid,
		class: className
	}: Props = $props();
	const id = $props.id();
	let input = $state<HTMLInputElement>();

	function onWindowKey(event: KeyboardEvent) {
		if (!shortcut || event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return;
		if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
		event.preventDefault();
		input?.focus();
	}

	function onkeydown(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (event.key !== 'Enter' || event.isComposing) return;
		event.preventDefault();
		if (oncommit?.() !== false) event.currentTarget.blur();
	}
</script>

<svelte:window onkeydown={onWindowKey} />

<div class={['search-field', className]}>
	<label class="icon" for={id}>
		<span class="visually-hidden">{label}</span>
		<Icon name="search" />
	</label>
	<ClearableField bind:value label={clearLabel} onclear={() => oninput?.('')}>
		<input
			{id}
			bind:this={input}
			bind:value
			type="search"
			{placeholder}
			aria-keyshortcuts={shortcut ? '/' : undefined}
			title={shortcut ? t('common.searchShortcut') : undefined}
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			enterkeyhint="search"
			data-testid={testid}
			{onkeydown}
			oninput={(e) => oninput?.(e.currentTarget.value)}
		/>
	</ClearableField>
</div>

<style>
	.search-field {
		display: flex;
		align-items: center;
		min-width: 0;
		min-height: var(--tap-target);
		box-sizing: border-box;
		padding-inline-start: var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-full);
		background: var(--card-background);
		color: var(--on-surface);
		font-family: var(--font-control);
	}
	/* One focus mark, on the box's own rounded border, drawn inside so nothing clips it; the
	   input's ring is off (Trevor, 2026-10-16: no double halo). */
	.search-field:focus-within {
		border-color: var(--focus);
		box-shadow: inset 0 0 0 calc(0.0625 * var(--u)) var(--focus);
	}
	.icon {
		display: grid;
		place-items: center;
		align-self: stretch;
		padding-inline: var(--space-1);
		color: var(--on-surface-muted);
		cursor: text;
	}
	input {
		min-height: var(--tap-target);
		padding-block: 0;
		padding-inline-start: var(--space-1);
		border: 0;
		outline: none;
		background: none;
		color: inherit;
		font: inherit;
		font-size: max(1rem, 16px); /* px-ok: iOS zooms into fields under 16px */
	}
	input:focus-visible {
		outline: none;
	}
</style>

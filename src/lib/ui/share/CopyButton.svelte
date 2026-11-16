<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { copyText } from '#lib/ui/clipboard.ts';

	/**
	 * A copy icon that shows a check for a moment instead of a success popup: the share
	 * screen's code and link, and Grim view's password (Trevor, 2026-10-27). `labelled` draws it
	 * as a button with its label beside the icon (the Install app dialog's Copy link).
	 */
	interface Props {
		label: string;
		/** What is copied; undefined or '' disables the button. */
		text: string | undefined;
		/** The toast when the clipboard refuses it. */
		failed: string;
		/** The toast's second line; null for none. */
		hint?: string | null;
		labelled?: boolean;
		disabled?: boolean;
	}

	let {
		label,
		text,
		failed,
		hint = t('share.copyFailedHint'),
		labelled = false,
		disabled = false
	}: Props = $props();

	const COPIED_MS = 1500;
	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => () => clearTimeout(timer));

	async function copy() {
		if (!text) return;
		if (!(await copyText(text, { failed: hint ? [failed, hint] : [failed] }))) return;
		copied = true;
		clearTimeout(timer);
		timer = setTimeout(() => (copied = false), COPIED_MS);
	}
</script>

{#if labelled}<Button icon={copied ? 'check' : 'copy'} onclick={copy} disabled={disabled || !text}
		>{label}</Button
	>{:else}<IconButton
		icon={copied ? 'check' : 'copy'}
		{label}
		onclick={copy}
		disabled={disabled || !text}
	/>{/if}

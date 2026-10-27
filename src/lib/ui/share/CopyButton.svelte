<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { copyText } from '#lib/ui/clipboard.ts';

	/**
	 * A copy icon that shows a check for a moment instead of a success popup: the share
	 * screen's code and link, and Grim view's password (Trevor, 2026-10-27).
	 */
	interface Props {
		label: string;
		/** What is copied; undefined or '' disables the button. */
		text: string | undefined;
		/** The toast when the clipboard refuses it. */
		failed: string;
		disabled?: boolean;
	}

	let { label, text, failed, disabled = false }: Props = $props();

	const COPIED_MS = 1500;
	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => () => clearTimeout(timer));

	async function copy() {
		if (!text) return;
		if (!(await copyText(text, { failed: [failed, t('share.copyFailedHint')] }))) return;
		copied = true;
		clearTimeout(timer);
		timer = setTimeout(() => (copied = false), COPIED_MS);
	}
</script>

<IconButton icon={copied ? 'check' : 'copy'} {label} onclick={copy} disabled={disabled || !text} />

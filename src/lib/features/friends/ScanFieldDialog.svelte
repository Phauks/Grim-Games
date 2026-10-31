<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import QrScanner from '#lib/ui/share/QrScanner.svelte';

	/**
	 * One field in a dialog, committed by Enter or Confirm, with its refusal kept under it so
	 * the buttons never move: Add friend's username (plan F1) and a group's name or code (F6).
	 * With `read`, a camera in the field reads a QR code into it (Trevor, 2026-10-30); `read`
	 * gives the field's text from a scan, or undefined with `notCode` shown for anything else.
	 */
	interface Props {
		open?: boolean;
		value?: string;
		title: string;
		label: string;
		maxlength: number;
		valid: boolean;
		busy: boolean;
		error: string;
		confirmLabel: string;
		onConfirm: () => void;
		read?: (text: string) => string | undefined;
		notCode?: string;
	}

	let {
		open = $bindable(false),
		value = $bindable(''),
		title,
		label,
		maxlength,
		valid,
		busy,
		error,
		confirmLabel,
		onConfirm,
		read,
		notCode = ''
	}: Props = $props();

	let scanning = $state(false);
	let scanProblem = $state('');

	function scanned(text: string): boolean {
		const found = read?.(text);
		if (!found) {
			scanProblem = notCode;
			return false;
		}
		value = found;
		scanning = false;
		return true;
	}
</script>

<Dialog bind:open {title}>
	<TextField
		plain
		{label}
		bind:value
		{maxlength}
		autocomplete="off"
		spellcheck={false}
		invalid={value.trim() !== '' && !valid}
		disabled={busy}
		oncommit={onConfirm}
		end={read ? scan : undefined}
	/>
	<p class="error" role="status">{error}</p>
	{#snippet actions()}
		<ModalActions
			onCancel={() => (open = false)}
			{onConfirm}
			{confirmLabel}
			disabled={!valid || busy}
		/>
	{/snippet}
</Dialog>

{#snippet scan()}
	<!-- The camera in the field, as on Join game (Trevor, 2026-10-30). -->
	<IconButton
		icon="scan"
		label={t('share.scan')}
		disabled={busy}
		onclick={() => {
			scanProblem = '';
			scanning = true;
		}}
	/>
{/snippet}

<Dialog bind:open={scanning} title={t('share.scan')}>
	{#if scanning}<QrScanner onRead={scanned} problem={scanProblem} />{/if}
</Dialog>

<style>
	.error {
		margin: var(--space-1) 0 0;
		min-height: 1lh;
		color: var(--evil-text);
		overflow-wrap: anywhere;
	}
</style>

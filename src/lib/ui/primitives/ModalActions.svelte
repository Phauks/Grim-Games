<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from './Button.svelte';

	/**
	 * The buttons of every modal where the Storyteller makes a decision (Trevor, 2026-10-17:
	 * "Always be cancel or confirm. Should always be at the bottom right of a modal. Should be
	 * unified component"): Cancel, then Confirm, at the bottom right. Leave out `onCancel` or
	 * `onConfirm` for a modal that only has the other (a list whose rows are the choices
	 * still has Cancel). "Done" and "Close" are not decisions and stay their own buttons.
	 * The lint `grim/modal-actions` sends every Cancel, Confirm, Save or OK in a modal here.
	 */
	interface Props {
		/** Shows Cancel; runs when it is pressed. */
		onCancel?: () => void;
		/** Shows Confirm; runs when it is pressed (with `submit`, the form's submit does). */
		onConfirm?: () => void;
		/** Confirm can't be pressed yet. */
		disabled?: boolean;
		/** Deletes, removes or can't be undone: Confirm is red. */
		danger?: boolean;
		/** Confirm submits the form it sits in, so Enter in a field confirms too. */
		submit?: boolean;
		/** Other tools for the decision (e.g. "Paste from clipboard"), at the bottom left. */
		start?: Snippet;
	}

	let {
		onCancel,
		onConfirm,
		disabled = false,
		danger = false,
		submit = false,
		start
	}: Props = $props();
</script>

<div class="modal-actions">
	{#if start}<span class="start">{@render start()}</span>{/if}
	{#if onCancel}
		<Button variant="quiet" onclick={() => onCancel?.()}>{t('common.cancel')}</Button>
	{/if}
	{#if onConfirm || submit}
		<Button
			variant={danger ? 'danger' : 'accent'}
			icon="check"
			type={submit ? 'submit' : 'button'}
			{disabled}
			onclick={submit ? undefined : () => onConfirm?.()}>{t('common.confirm')}</Button
		>
	{/if}
</div>

<style>
	/* Stays in view at the bottom of a long modal, over what scrolls under it. */
	.modal-actions {
		position: sticky;
		bottom: 0;
		display: flex;
		flex: 1 1 100%;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
		padding-top: var(--space-3);
		background: var(--modal-actions-background, var(--sheet-background));
	}
	.start {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-inline-end: auto;
	}
</style>

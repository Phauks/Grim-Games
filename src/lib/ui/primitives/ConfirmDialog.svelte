<script lang="ts">
	import type { Snippet } from 'svelte';
	import Dialog from './Dialog.svelte';
	import ModalActions from './ModalActions.svelte';

	/**
	 * Every confirmation (Trevor, 2026-10-16): the question, what changes, then Cancel and
	 * Confirm (ModalActions). The action button always says Confirm; destructive ones are red. The lint
	 * `grim/confirm-dialog` sends every `role="alertdialog"` here.
	 */
	interface Props {
		open?: boolean;
		title: string;
		/** Replaces the title's text, e.g. with a character badge. */
		heading?: Snippet;
		description?: string;
		/** Deletes or removes something: Confirm is red. */
		danger?: boolean;
		/** Confirm can't be pressed yet (a request is running). */
		disabled?: boolean;
		/** What happens, shown above the buttons. */
		children?: Snippet;
		/** Runs on Confirm; the dialog closes first. */
		onConfirm: () => void;
		/** Runs on Cancel, after the dialog closes. */
		onCancel?: () => void;
	}

	let {
		open = $bindable(false),
		title,
		heading,
		description,
		danger = false,
		disabled = false,
		children,
		onConfirm,
		onCancel
	}: Props = $props();
</script>

<Dialog bind:open {title} {heading} {description} role="alertdialog">
	{@render children?.()}
	{#snippet actions()}
		<ModalActions
			{danger}
			{disabled}
			onCancel={() => {
				open = false;
				onCancel?.();
			}}
			onConfirm={() => {
				open = false;
				onConfirm();
			}}
		/>
	{/snippet}
</Dialog>

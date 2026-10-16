<script lang="ts">
	import { setLeaveGuard } from '#lib/features/shell/shell.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	interface Props {
		/** Ask before leaving while this is true. */
		when: boolean;
		title: string;
		/** What is left behind, stated plainly. */
		body: string;
	}

	let { when, title, body }: Props = $props();

	let open = $state(false);
	/** The way out the Storyteller asked for, run on Confirm. */
	let pending: (() => void) | undefined;

	// The app's leave guard stops every way off the page (links, menus, browser back) and
	// asks here first.
	$effect(() => {
		if (!when) return;
		return setLeaveGuard((leave) => {
			pending = leave;
			open = true;
		});
	});

	// Closing or reloading the tab gets the browser's own prompt.
	function beforeunload(event: BeforeUnloadEvent) {
		if (when) event.preventDefault();
	}

	function leave() {
		open = false;
		pending?.();
		pending = undefined;
	}
</script>

<svelte:window onbeforeunload={beforeunload} />

<!--
	Asks before leaving a page whose work a stray tap would interrupt (Trevor, 2026-10-16: the
	bag draw).
-->
<Dialog bind:open role="alertdialog" {title}>
	<p>{body}</p>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (open = false)}>{t('common.cancel')}</Button>
		<Button variant="accent" onclick={leave}>{t('common.confirm')}</Button>
	{/snippet}
</Dialog>

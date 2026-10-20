<script lang="ts">
	import { setLeaveGuard } from '#lib/features/shell/shell.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';

	interface Props {
		/** Ask before leaving while this is true. */
		when: boolean;
		title: string;
		/** What is left behind, stated plainly. */
		body: string;
		/** URLs that are still this screen, so going there doesn't ask (setLeaveGuard). */
		within?: (url: URL) => boolean;
		/**
		 * Closing or reloading the tab gets the browser's own prompt. Off where nothing is lost
		 * that way, because everything is already saved on the device.
		 */
		unload?: boolean;
	}

	let { when, title, body, within, unload = true }: Props = $props();

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
		}, within);
	});

	// Closing or reloading the tab gets the browser's own prompt.
	function beforeunload(event: BeforeUnloadEvent) {
		if (when && unload) event.preventDefault();
	}

	function leave() {
		pending?.();
		pending = undefined;
	}
</script>

<svelte:window onbeforeunload={beforeunload} />

<!--
	Asks before leaving a page whose work a stray tap would interrupt (Trevor, 2026-10-16: the
	bag draw).
-->
<ConfirmDialog bind:open {title} onConfirm={leave}>
	<p>{body}</p>
</ConfirmDialog>

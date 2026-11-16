<script lang="ts">
	import { setLeaveGuard } from '#lib/features/shell/shell.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import LeaveGameDialog, { type LeaveCard } from '#lib/features/room/LeaveGameDialog.svelte';
	import { leaveRoom } from '#lib/features/room/room-connection.ts';

	/** A game being left; `room` is its room's code, when the phone may leave the room too. */
	type Leaving = { title: string; card: LeaveCard; room?: string };

	interface Props {
		/** Ask before leaving while this is true. */
		when: boolean;
		title: string;
		/** What is left behind, stated plainly. */
		body?: string;
		/**
		 * A game being left, read as it asks: shown as Join game's card for it instead of `body`
		 * and `title`'s question is the card's own.
		 */
		card?: () => Leaving | undefined;
		/** URLs that are still this screen, so going there doesn't ask (setLeaveGuard). */
		within?: (url: URL) => boolean;
		/**
		 * Closing or reloading the tab gets the browser's own prompt. Off where nothing is lost
		 * that way, because everything is already saved on the device.
		 */
		unload?: boolean;
	}

	let { when, title, body, card, within, unload = true }: Props = $props();

	let open = $state(false);
	/** The game being left, as it was when the dialog opened. */
	let shown = $state<Leaving>();
	/** The way out the Storyteller asked for, run on Confirm. */
	let pending: (() => void) | undefined;

	// The app's leave guard stops every way off the page (links, menus, browser back) and
	// asks here first.
	$effect(() => {
		if (!when) return;
		return setLeaveGuard((leave) => {
			pending = leave;
			shown = card?.();
			open = true;
		}, within);
	});

	// Closing or reloading the tab gets the browser's own prompt.
	function beforeunload(event: BeforeUnloadEvent) {
		if (when && unload) event.preventDefault();
	}

	async function leave(room?: string) {
		const go = pending;
		pending = undefined;
		// Out of the room first, so it is gone from the screen the phone goes to.
		if (room) await leaveRoom(room);
		go?.();
	}
</script>

<svelte:window onbeforeunload={beforeunload} />

<!--
	Asks before leaving a page whose work a stray tap would interrupt (Trevor, 2026-10-16: the
	bag draw).
-->
{#if shown}<LeaveGameDialog
		bind:open
		title={shown.title}
		card={shown.card}
		room={!!shown.room}
		onConfirm={(out) => void leave(out ? shown?.room : undefined)}
	/>{:else}<ConfirmDialog bind:open {title} onConfirm={() => void leave()}>
		<p>{body}</p>
	</ConfirmDialog>{/if}

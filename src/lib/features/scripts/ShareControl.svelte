<script lang="ts">
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import type { ShareTarget } from './share-codes.ts';
	import SharePanel from './SharePanel.svelte';

	/**
	 * One button that opens one screen for sharing a link: QR code, link, code, Copy and
	 * Share (`SharePanel`). One control per link, so a Room link can sit beside the script
	 * link later without changing this one.
	 */
	interface Props {
		/** What the link is, in a few words: "script", later "room". */
		what: string;
		/** Shown in the share sheet and the dialog title, e.g. the script's name. */
		title: string;
		/** Makes the link; undefined disables the control (nothing to share yet). */
		target: (() => Promise<ShareTarget>) | undefined;
	}

	let { what, title, target }: Props = $props();
	let open = $state(false);
</script>

<div class="share">
	<Button onclick={() => (open = true)} disabled={!target}>Share {what}</Button>
</div>

<Dialog bind:open title="Share {title}">
	{#if target}
		<SharePanel {title} {target} ondelete={() => (open = false)} />
	{/if}
</Dialog>

<style>
	.share {
		display: flex;
		justify-content: flex-end;
	}
</style>

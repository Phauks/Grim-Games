<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import type { ShareTarget } from './share-codes.ts';
	import SharePanel from './SharePanel.svelte';

	/**
	 * One share icon (always an icon, Trevor 2026-10-16) that opens one screen for sharing a
	 * link: QR code, link, Copy and
	 * Share (`SharePanel`). One control per link, so a Room link can sit beside the script
	 * link later without changing this one.
	 */
	interface Props {
		/** What the link is: a script, later a room. */
		what: 'script';
		/** Shown in the share sheet and the dialog title, e.g. the script's name. */
		title: string;
		/** Makes the link; undefined disables the control (nothing to share yet). */
		target: (() => Promise<ShareTarget>) | undefined;
	}

	let { what, title, target }: Props = $props();
	let open = $state(false);
</script>

<div class="share">
	<IconButton
		icon="share"
		label={t(`scripts.share.button.${what}`)}
		onclick={() => (open = true)}
		disabled={!target}
	/>
</div>

<Dialog bind:open title={t('scripts.share.title', { title })}>
	{#if target}
		<SharePanel {title} {target} />
	{/if}
</Dialog>

<style>
	.share {
		display: flex;
		justify-content: flex-end;
	}
</style>

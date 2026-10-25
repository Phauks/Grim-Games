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
		/** The script's author and version, shown under the dialog's title when known. */
		author?: string;
		version?: string;
		/** The script's logo, for the middle of the QR code. */
		logo?: string;
		/** Makes the link; undefined disables the control (nothing to share yet). */
		target: (() => Promise<ShareTarget>) | undefined;
		/** The live room this device is in: Share hands on its link and join code instead. */
		room?: string;
	}

	let { what, title, author, version, logo, target, room }: Props = $props();
	let open = $state(false);

	/**
	 * The link is made (a share code fetched or created) as soon as the icon is pointed at,
	 * focused or pressed, and kept while the script is unchanged, so the QR code shows at
	 * once when the screen opens: the wait was the network, not drawing the QR.
	 */
	let made: { for: () => Promise<ShareTarget>; link: Promise<ShareTarget> } | undefined;
	function warm(): Promise<ShareTarget> | undefined {
		if (!target || room) return undefined;
		if (made?.for !== target) {
			const link = target();
			made = { for: target, link };
			// A failure is shown (and reported) by the share screen; try again next time.
			link.catch(() => {
				if (made?.link === link) made = undefined;
			});
		}
		return made.link;
	}
	const madeTarget = () => warm() ?? Promise.reject(new Error('Nothing to share'));
</script>

<div class="share">
	<IconButton
		icon="share"
		label={t(`scripts.share.button.${what}`)}
		onpointerenter={() => void warm()}
		onfocus={() => void warm()}
		onpointerdown={() => void warm()}
		onclick={() => {
			void warm();
			open = true;
		}}
		disabled={!target && !room}
	/>
</div>

<Dialog bind:open title={t('scripts.share.title', { title })}>
	{#if target || room}
		<SharePanel {title} {author} {version} {logo} target={madeTarget} {room} />
	{/if}
</Dialog>

<style>
	.share {
		display: flex;
		justify-content: flex-end;
	}
</style>

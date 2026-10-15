<script lang="ts">
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import QrCode, { fitsQrCode } from '#lib/ui/primitives/QrCode.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';

	/**
	 * Shares one link three ways: the phone's share sheet (or copying, where there is none)
	 * and a QR code for passing a phone round the table. One control per link, so a Room
	 * link can sit beside the script link later without changing this one.
	 */
	interface Props {
		/** What the link is, in a few words: "script", later "room". */
		what: string;
		/** Shown in the share sheet and on the QR dialog, e.g. the script's name. */
		title: string;
		/** The link; undefined disables the control (nothing to share yet). */
		url: string | undefined;
	}

	let { what, title, url }: Props = $props();
	let qrOpen = $state(false);

	const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

	async function copy(link: string) {
		try {
			await navigator.clipboard.writeText(link);
			toast('Link copied');
		} catch {
			toast('Could not copy the link', 'Use the QR code instead.');
		}
	}

	async function share() {
		if (!url) return;
		if (canShare) {
			try {
				await navigator.share({ title, url });
				return;
			} catch (e) {
				// Closing the share sheet is not a failure.
				if (e instanceof DOMException && e.name === 'AbortError') return;
			}
		}
		await copy(url);
	}
</script>

<div class="share" role="group" aria-label="Share {what}">
	<Button onclick={share} disabled={!url}>{canShare ? `Share ${what}` : 'Copy link'}</Button>
	<Button onclick={() => (qrOpen = true)} disabled={!url}>QR code</Button>
</div>

<Dialog bind:open={qrOpen} title="{title} QR code">
	<div class="code">
		{#if url && fitsQrCode(url)}
			<QrCode value={url} label="QR code for {title}" />
		{:else}
			<!-- Same square as the code, so the dialog keeps its size. -->
			<p class="too-long">
				Too long for a QR code. Use {canShare ? `Share ${what}` : 'Copy link'}.
			</p>
		{/if}
	</div>
	{#snippet actions()}
		<Button variant="accent" onclick={() => url && copy(url)} disabled={!url}>Copy link</Button>
	{/snippet}
</Dialog>

<style>
	.share {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-2);
	}
	.code {
		width: min(100%, calc(18 * var(--u)));
		margin: var(--space-3) auto 0;
	}
	.too-long {
		aspect-ratio: 1;
		margin: 0;
		display: grid;
		place-items: center;
		padding: var(--space-4);
		text-align: center;
		border: var(--card-border);
		border-radius: var(--radius-md);
	}
</style>

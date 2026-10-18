<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import QrCode, { fitsQrCode } from '#lib/ui/primitives/QrCode.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';

	/**
	 * The one share screen (Trevor, 2026-10-18): an optional code in large type, the QR code,
	 * the link with Copy and Share icons, and room for the caller's own buttons. Used for a
	 * script link and for a live room, where the code is the room code players can type at
	 * /join. Laid out the same before the link exists, so nothing moves when it arrives.
	 */
	interface Props {
		/** The link; undefined while it is being made. */
		url: string | undefined;
		/** Shown in the share sheet. */
		title: string;
		/** The QR code's accessible name. */
		qrLabel: string;
		/** Shown in the QR's square while there is no link (making it, or why it failed). */
		pending: string;
		/** A code to type instead of opening the link; its heading is `codeLabel`. */
		code?: { label: string; value: string | undefined };
		/**
		 * A line sent before the link by Share and Copy, e.g. with the code, for apps and
		 * people who can't open the link.
		 */
		text?: string;
		/** The caller's own buttons after Copy and Share (e.g. Close room). */
		actions?: Snippet;
	}

	let { url, title, qrLabel, pending, code, text, actions }: Props = $props();
	const id = $props.id();
	const urlId = `${id}-url`;
	const codeId = `${id}-code`;

	const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

	/** The copy icon shows a check for a moment instead of a success popup. */
	const COPIED_MS = 1500;
	let copied = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => () => clearTimeout(copiedTimer));

	async function copy() {
		if (!url) return;
		try {
			await navigator.clipboard.writeText(text ? `${text}\n${url}` : url);
			copied = true;
			clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => (copied = false), COPIED_MS);
		} catch {
			toast(t('share.copyFailed'), t('share.copyFailedHint'));
		}
	}

	async function share() {
		if (!url) return;
		try {
			await navigator.share(text ? { title, text, url } : { title, url });
		} catch (e) {
			// Closing the share sheet is not a failure.
			if (!(e instanceof DOMException && e.name === 'AbortError')) await copy();
		}
	}
</script>

<div class="share">
	{#if code}
		<div class="code-block">
			<span class="code-label" id={codeId}>{code.label}</span>
			<p class="code" aria-labelledby={codeId} data-testid="share-code">
				{code.value ?? '··· ···'}
			</p>
		</div>
	{/if}
	<div class="qr">
		{#if url && fitsQrCode(url)}
			<QrCode value={url} label={qrLabel} />
		{:else}
			<p class="placeholder" aria-busy={!url}>{url ? t('share.tooLong') : pending}</p>
		{/if}
	</div>
	<div class="link">
		<label class="label" for={urlId}>{t('share.link')}</label>
		<div class="link-row">
			<input
				id={urlId}
				type="text"
				readonly
				value={url ?? ''}
				placeholder={t('common.none')}
				data-testid="share-url"
			/>
			<IconButton
				icon={copied ? 'check' : 'copy'}
				label={t('share.copy')}
				onclick={copy}
				disabled={!url}
			/>
			{#if canShare}
				<IconButton icon="share" label={t('share.share')} onclick={share} disabled={!url} />
			{/if}
		</div>
	</div>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</div>

<style>
	.share {
		display: grid;
		gap: var(--space-3);
		align-content: start;
		min-width: 0;
	}
	.code-block {
		display: grid;
		gap: var(--space-1);
	}
	.code-label,
	.label {
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
	.code {
		margin: 0;
		font-family: var(--font-heading);
		font-size: 2.6rem;
		letter-spacing: 0.08em;
		font-variant-numeric: tabular-nums;
	}
	.qr {
		width: min(100%, calc(16 * var(--u)));
	}
	/* The QR's own square, held until the link exists. */
	.placeholder {
		box-sizing: border-box;
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		margin: 0;
		padding: var(--space-4);
		border: var(--card-border);
		border-radius: var(--radius-md);
		color: var(--on-surface-muted);
		text-align: center;
	}
	.link {
		display: grid;
		gap: var(--space-1);
	}
	.link-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: var(--space-1);
	}
	.link input {
		box-sizing: border-box;
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--on-surface);
		font-size: max(0.9rem, 16px); /* px-ok: iOS zooms into fields under 16px */
		text-overflow: ellipsis;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>

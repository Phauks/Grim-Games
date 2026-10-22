<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import QrCode, { fitsQrCode } from '#lib/ui/primitives/QrCode.svelte';
	import { copyText } from '#lib/ui/clipboard.ts';

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
		/** The caller's own buttons after Copy and Share. */
		actions?: Snippet;
		/**
		 * A refresh icon beside Copy that replaces the link (Trevor, 2026-10-20), named by
		 * `label` for screen readers and tooltips.
		 */
		refresh?: { label: string; onclick: () => void; disabled?: boolean };
		/** Drawn in the middle of the QR code, e.g. the script's logo (see `QrCode`). */
		qrCenter?: Snippet;
		qrCenterShape?: 'square' | 'wide';
		/** A short warning on the QR's bottom edge (`QrCode`'s `caption`). */
		qrCaption?: string;
		/**
		 * Covers the QR and the link in place, e.g. while streaming (Trevor, 2026-10-21);
		 * Copy and Share still work.
		 */
		hidden?: boolean;
	}

	let {
		url,
		title,
		qrLabel,
		pending,
		code,
		text,
		actions,
		refresh,
		qrCenter,
		qrCenterShape,
		qrCaption,
		hidden = false
	}: Props = $props();
	const id = $props.id();
	const urlId = `${id}-url`;
	const codeId = `${id}-code`;

	const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

	/** A copy icon shows a check for a moment instead of a success popup. */
	const COPIED_MS = 1500;
	let copied = $state<'link' | 'code' | undefined>();
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => () => clearTimeout(copiedTimer));

	function showCopied(what: 'link' | 'code') {
		copied = what;
		clearTimeout(copiedTimer);
		copiedTimer = setTimeout(() => (copied = undefined), COPIED_MS);
	}

	async function copy() {
		if (!url) return;
		const done = await copyText(text ? `${text}\n${url}` : url, {
			failed: [t('share.copyFailed'), t('share.copyFailedHint')]
		});
		if (done) showCopied('link');
	}

	/** The code alone, without the spaces that group it for reading (Trevor, 2026-10-19). */
	async function copyCode() {
		if (!code?.value) return;
		const done = await copyText(code.value.replace(/\s/g, ''), {
			failed: [t('share.copyCodeFailed'), t('share.copyFailedHint')]
		});
		if (done) showCopied('code');
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
			<!-- The code and the link each under a header (Trevor, 2026-10-20). -->
			<h2 class="header" id={codeId}>{code.label}</h2>
			<div class="code-row">
				<p class="code" aria-labelledby={codeId} data-testid="share-code">
					{code.value ?? '··· ···'}
				</p>
				<IconButton
					icon={copied === 'code' ? 'check' : 'copy'}
					label={t('share.copyCode')}
					onclick={copyCode}
					disabled={!code.value}
				/>
			</div>
		</div>
	{/if}
	<div class="qr" class:hidden={url && hidden}>
		{#if url && fitsQrCode(url)}
			<!-- Hidden keeps the QR's place, covered, so nothing moves. -->
			<QrCode
				value={url}
				label={qrLabel}
				center={qrCenter}
				centerShape={qrCenterShape}
				caption={qrCaption}
			/>
			{#if hidden}<p class="placeholder cover" data-testid="share-hidden">
					{t('share.hidden')}
				</p>{/if}
		{:else}
			<p class="placeholder" aria-busy={!url}>{url ? t('share.tooLong') : pending}</p>
		{/if}
	</div>
	<div class="link">
		<h2 class="header" id={urlId}>{t('share.link')}</h2>
		<div class="link-row">
			<input
				aria-labelledby={urlId}
				type="text"
				readonly
				value={url && hidden ? t('share.hidden') : (url ?? '')}
				placeholder={t('common.none')}
				data-testid="share-url"
			/>
			<IconButton
				icon={copied === 'link' ? 'check' : 'copy'}
				label={t('share.copy')}
				onclick={copy}
				disabled={!url}
			/>
			{#if refresh}
				<IconButton
					icon="refresh"
					label={refresh.label}
					onclick={refresh.onclick}
					disabled={refresh.disabled}
				/>
			{/if}
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
	.header {
		margin: 0;
		font-size: 1.1rem;
	}
	/* The copy icon sits right after the code. */
	.code-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.code {
		margin: 0;
		font-family: var(--font-heading);
		font-size: 2.6rem;
		letter-spacing: 0.08em;
		font-variant-numeric: tabular-nums;
	}
	.qr {
		position: relative;
		width: min(100%, calc(16 * var(--u)));
	}
	.qr.hidden > :global(:not(.cover)) {
		visibility: hidden;
	}
	.cover {
		position: absolute;
		inset: 0;
		background: var(--surface);
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
		grid-template-columns: minmax(0, 1fr);
		grid-auto-columns: auto;
		grid-auto-flow: column;
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

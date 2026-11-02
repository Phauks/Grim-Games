<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import QrCode, { fitsQrCode } from '#lib/ui/primitives/QrCode.svelte';
	import { copyText } from '#lib/ui/clipboard.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { qrPicture } from './qr-picture.svelte.ts';
	import QrCentreSetting from './QrCentreSetting.svelte';
	import QrPicture from './QrPicture.svelte';
	import CopyButton from './CopyButton.svelte';
	import ShareCode from './ShareCode.svelte';

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
		/**
		 * A file to send as well as the link, e.g. a game recap's page, offered where the phone
		 * can share files; sending it can fail over to `onFileFailed` (e.g. a download).
		 */
		file?: File;
		onFileFailed?: () => void;
		/**
		 * An animated code in the QR's place (offline games, Trevor 2026-10-26): frames shown one
		 * after another, which the app's own scanner collects. Drawn without a middle.
		 */
		frames?: string[];
		/**
		 * No middle, so the code uses the lowest error correction and stays small enough to read
		 * off another phone's screen (offline codes, which carry a whole script).
		 */
		plain?: boolean;
		/** Beside the code's header (`ShareCode`'s `status`). */
		codeStatus?: Snippet;
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
		hidden = false,
		file,
		onFileFailed,
		frames,
		plain = false,
		codeStatus
	}: Props = $props();

	/** Five frames a second: near the 6–7 Divan found fastest (https://divan.dev/posts/animatedqr/); a missed frame costs little with a fountain code. */
	const FRAME_MS = 200;
	let frame = $state(0);
	$effect(() => {
		if (!frames?.length) return;
		frame = 0;
		const count = frames.length;
		const timer = setInterval(() => (frame = (frame + 1) % count), FRAME_MS);
		return () => clearInterval(timer);
	});
	/*
	 * The middle of the QR is the Storyteller's choice (plan R1): the caller's (the script's
	 * logo or name), their own picture, or nothing. Set here or in Settings.
	 */
	const centre = $derived(preferences.current.qrCentre);
	const usePicture = $derived(centre === 'picture' && !!qrPicture.current);
	const middle = $derived(
		centre === 'none' || plain ? undefined : usePicture ? pictureCentre : qrCenter
	);
	const middleShape = $derived(usePicture ? 'square' : qrCenterShape);
	let centreOpen = $state(false);
	const id = $props.id();
	const urlId = `${id}-url`;

	const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
	const canShareFile = $derived(!!file && canShare && !!navigator.canShare?.({ files: [file] }));

	async function share() {
		if (!url) return;
		try {
			await navigator.share(text ? { title, text, url } : { title, url });
		} catch (e) {
			// Closing the share sheet is not a failure.
			if (!(e instanceof DOMException && e.name === 'AbortError'))
				await copyText(text ? `${text}\n${url}` : url, {
					failed: [t('share.copyFailed'), t('share.copyFailedHint')]
				});
		}
	}

	async function shareFile() {
		if (!file) return;
		try {
			await navigator.share({ title, files: [file] });
		} catch (e) {
			if (!(e instanceof DOMException && e.name === 'AbortError')) onFileFailed?.();
		}
	}
</script>

<!-- Two columns where there's room (Trevor, 2026-11-01: "the code on the left and the info on
     the right"): the QR code, then the code, link and the caller's buttons beside it. A phone
     keeps one column, the code over the QR. -->
<div class="share">
	<div class="layout">
		<div class="qr" class:hidden={url && hidden}>
			{#if frames?.length}
				<QrCode
					value={frames[frame % frames.length]}
					label={qrLabel}
					caption={qrCaption}
					modules={preferences.current.qrModules}
					finders={preferences.current.qrFinders}
				/>
			{:else if url && fitsQrCode(url)}
				<!-- Hidden keeps the QR's place, covered, so nothing moves. -->
				<QrCode
					value={url}
					label={qrLabel}
					center={middle}
					centerShape={middleShape}
					caption={qrCaption}
					modules={preferences.current.qrModules}
					finders={preferences.current.qrFinders}
				/>
				{#if hidden}<p class="placeholder cover" data-testid="share-hidden">
						{t('share.hidden')}
					</p>{/if}
			{:else}
				<p class="placeholder" aria-busy={!url}>{url ? t('share.tooLong') : pending}</p>
			{/if}
		</div>
		<div class="info">
			{#if code}
				<div class="code">
					<ShareCode label={code.label} value={code.value} status={codeStatus} />
				</div>
			{/if}
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
					<CopyButton
						label={t('share.copy')}
						text={url && (text ? `${text}\n${url}` : url)}
						failed={t('share.copyFailed')}
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
					<!-- The QR's look, set where it shows as well as in Settings. -->
					<IconButton
						icon="settings"
						label={t('share.qrSettings')}
						onclick={() => (centreOpen = true)}
					/>
				</div>
			</div>
			{#if actions || canShareFile}<div class="actions">
					{#if canShareFile}<Button onclick={() => void shareFile()}>{t('share.sendFile')}</Button
						>{/if}
					{@render actions?.()}
				</div>{/if}
		</div>
	</div>
</div>

{#snippet pictureCentre()}
	<QrPicture />
{/snippet}

<!-- A dialog, not a popover, so no list ends up under its edge: the QR code on the left and
     its settings on the right (Trevor, 2026-10-24), or the code on top of them on a phone,
     so every change shows at once. -->
<Dialog bind:open={centreOpen} title={t('share.qrSettings')}>
	{#snippet aside()}
		<div class="preview" data-testid="qr-preview">
			{#if url && fitsQrCode(url)}
				<QrCode
					value={url}
					label={qrLabel}
					center={middle}
					centerShape={middleShape}
					modules={preferences.current.qrModules}
					finders={preferences.current.qrFinders}
				/>
			{:else}
				<p class="placeholder">{url ? t('share.tooLong') : pending}</p>
			{/if}
		</div>
	{/snippet}
	<div class="centre"><QrCentreSetting /></div>
</Dialog>

<style>
	.header {
		margin: 0;
		font-size: 1.1rem;
	}
	/* The dialog's aside: small on top of a phone's settings, the pane's width beside them. */
	.preview {
		display: grid;
		justify-items: center;
	}
	.preview > :global(*) {
		width: min(45%, calc(10 * var(--u)));
	}
	@container dialog-panes (min-width: 36rem) {
		.preview > :global(*) {
			width: 100%;
		}
	}
	.centre {
		display: grid;
		gap: var(--space-2);
	}
	.share {
		container: share / inline-size;
		min-width: 0;
	}
	.layout,
	.info {
		display: grid;
		gap: var(--space-3);
		align-content: start;
		min-width: 0;
	}
	/* One column: the info's parts sit among the QR's, the code first. */
	.info {
		display: contents;
	}
	.qr {
		order: 1;
	}
	.link {
		order: 2;
	}
	.actions {
		order: 3;
	}
	@container share (min-width: 36rem) {
		.layout {
			grid-template-columns: calc(16 * var(--u)) minmax(0, 1fr);
			align-items: start;
		}
		.info {
			display: grid;
		}
		.qr {
			order: 0;
			width: 100%;
		}
	}
	/* The caption's room is kept with or without one (QrCode's 0.8em), so turning on the
	   offline code's warning moves nothing below it (Trevor, 2026-10-29). */
	.qr {
		--qr-caption-room: 0;
		position: relative;
		width: min(100%, calc(16 * var(--u)));
		padding-bottom: 0.8em;
	}
	.qr.hidden > :global(:not(.cover)) {
		visibility: hidden;
	}
	.cover {
		position: absolute;
		inset: 0 0 0.8em; /* not over the caption's room */
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

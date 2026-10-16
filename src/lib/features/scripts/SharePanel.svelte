<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
	import { formatDigitCode } from '#lib/core/codes/digit-code.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import QrCode, { fitsQrCode } from '#lib/ui/primitives/QrCode.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import type { ShareTarget } from './share-codes.ts';

	/**
	 * Everything for sharing one link on one screen (Trevor, 2026-10-16): the QR code,
	 * the link with a copy button, its six-digit code, and the phone's own Share. The link is
	 * made when this appears (it lives inside a dialog), so nothing is uploaded just by
	 * opening a page.
	 */
	interface Props {
		/** Shown in the share sheet and the QR code's name, e.g. the script's name. */
		title: string;
		/** Makes the link. */
		target: () => Promise<ShareTarget>;
	}

	let { title, target }: Props = $props();
	const urlId = $props.id();
	let made = $state.raw<ShareTarget | undefined>();
	let failed = $state(false);

	const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

	onMount(() => {
		let live = true;
		target().then(
			(t) => {
				if (live) made = t;
			},
			(e) => {
				if (live) failed = true;
				reportError(e, { area: 'scripts' });
			}
		);
		return () => {
			live = false;
		};
	});

	/** The copy icon shows a check for a moment instead of a success popup. */
	const COPIED_MS = 1500;
	let copied = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => () => clearTimeout(copiedTimer));

	async function copy() {
		if (!made) return;
		try {
			await navigator.clipboard.writeText(made.url);
			copied = true;
			clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => (copied = false), COPIED_MS);
		} catch {
			toast(t('scripts.share.copyFailed'), t('scripts.share.copyFailedHint'));
		}
	}

	async function share() {
		if (!made) return;
		try {
			await navigator.share({ title, url: made.url });
		} catch (e) {
			// Closing the share sheet is not a failure.
			if (!(e instanceof DOMException && e.name === 'AbortError')) await copy();
		}
	}
</script>

<div class="panel">
	<div class="code">
		{#if made && fitsQrCode(made.url)}
			<QrCode value={made.url} label={t('scripts.share.qr', { title })} />
		{:else}
			<!-- Same square as the code, so nothing moves when it arrives. -->
			<p class="placeholder">
				{made
					? t('scripts.share.tooLong')
					: failed
						? t('scripts.share.failed')
						: t('scripts.share.making')}
			</p>
		{/if}
	</div>

	<div class="link">
		<label class="label" for={urlId}>{t('scripts.share.link')}</label>
		<div class="link-row">
			<input
				id={urlId}
				type="text"
				readonly
				value={made?.url ?? ''}
				placeholder={t('common.none')}
				data-testid="share-url"
			/>
			<IconButton
				icon={copied ? 'check' : 'copy'}
				label={t('scripts.share.copy')}
				onclick={copy}
				disabled={!made}
			/>
		</div>
	</div>

	<!-- One line either way, so nothing moves when the code arrives. -->
	<p class="code-line" data-testid="share-code">
		<span class="label">{t('scripts.share.code')}</span>
		{#if made?.code}
			<span class="digits" data-testid="share-digits">{formatDigitCode(made.code)}</span>
		{:else}
			<span class="none">{t('common.none')}</span>
		{/if}
	</p>

	<div class="buttons">
		<Button variant="accent" onclick={share} disabled={!made || !canShare}
			>{t('scripts.share.share')}</Button
		>
	</div>
</div>

<style>
	.panel {
		display: grid;
		gap: var(--space-3);
		margin-top: var(--space-3);
	}
	.code {
		width: min(100%, calc(16 * var(--u)));
		margin: 0 auto;
	}
	.placeholder {
		aspect-ratio: 1;
		margin: 0;
		display: grid;
		place-items: center;
		padding: var(--space-4);
		text-align: center;
		border: var(--card-border);
		border-radius: var(--radius-md);
	}
	.link {
		display: grid;
		gap: var(--space-1);
	}
	.link-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-1);
	}
	.link input {
		width: 100%;
		box-sizing: border-box;
		min-height: var(--tap-target);
		padding: var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: max(0.9rem, 16px); /* px-ok: iOS zooms into fields under 16px */
		text-overflow: ellipsis;
	}
	.label {
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
	.code-line {
		margin: 0;
		min-height: 1lh;
		display: flex;
		justify-content: center;
		align-items: baseline;
		gap: var(--space-2);
		font-size: 1.6rem;
	}
	.digits {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.1em;
	}
	.none {
		color: var(--on-surface-muted);
	}
	.buttons {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
	}
</style>

<script lang="ts">
	import { formatDigitCode } from '#lib/core/codes/digit-code.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import QrCode, { fitsQrCode } from '#lib/ui/primitives/QrCode.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { deleteShareCode, type ShareTarget } from './share-codes.ts';

	/**
	 * Shares one link three ways: the phone's share sheet (or copying, where there is none),
	 * a QR code, and its six-digit code to read aloud. The link is made only when Share or QR
	 * code is tapped, so nothing is uploaded just by opening a page. One control per link,
	 * so a Room link can sit beside the script link later without changing this one.
	 */
	interface Props {
		/** What the link is, in a few words: "script", later "room". */
		what: string;
		/** Shown in the share sheet and on the QR dialog, e.g. the script's name. */
		title: string;
		/** Makes the link; undefined disables the control (nothing to share yet). */
		target: (() => Promise<ShareTarget>) | undefined;
	}

	let { what, title, target }: Props = $props();
	let qrOpen = $state(false);
	let made = $state.raw<ShareTarget | undefined>();
	let making: Promise<ShareTarget> | undefined;

	const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

	// A different script (or none) means a different link.
	$effect(() => {
		void target;
		made = undefined;
		making = undefined;
	});

	function resolve(): Promise<ShareTarget> | undefined {
		if (!target) return undefined;
		const mine = (making ??= target());
		mine.then(
			(t) => {
				if (making === mine) made = t;
			},
			(e) => {
				if (making === mine) making = undefined;
				reportError(e, { area: 'scripts' });
			}
		);
		return mine;
	}

	async function copy(link: string) {
		try {
			await navigator.clipboard.writeText(link);
			toast('Link copied');
		} catch {
			toast('Could not copy the link', 'Use the QR code instead.');
		}
	}

	async function share() {
		const t = made ?? (await resolve()?.catch(() => undefined));
		if (!t) return;
		if (canShare) {
			try {
				await navigator.share({ title, url: t.url });
				return;
			} catch (e) {
				// Closing the share sheet is not a failure.
				if (e instanceof DOMException && e.name === 'AbortError') return;
				// Some browsers refuse a share that waited for the code; the dialog has it ready.
				if (e instanceof DOMException && e.name === 'NotAllowedError') {
					qrOpen = true;
					return;
				}
			}
		}
		await copy(t.url);
	}

	function openQr() {
		qrOpen = true;
		void resolve()?.catch(() => undefined);
	}

	async function deleteCode() {
		const code = made?.code;
		if (!code) return;
		try {
			await deleteShareCode(code);
			toast('Code deleted', 'Sharing again makes a new code.');
			qrOpen = false;
			made = undefined;
			making = undefined;
		} catch (e) {
			reportError(e, { area: 'scripts' });
		}
	}
</script>

<div class="share" role="group" aria-label="Share {what}">
	<Button onclick={share} disabled={!target}>{canShare ? `Share ${what}` : 'Copy link'}</Button>
	<Button onclick={openQr} disabled={!target}>QR code</Button>
</div>

<Dialog bind:open={qrOpen} title="{title} QR code">
	<div class="code">
		{#if made && fitsQrCode(made.url)}
			<QrCode value={made.url} label="QR code for {title}" />
		{:else}
			<!-- Same square as the code, so the dialog keeps its size. -->
			<p class="placeholder">
				{made
					? `Too long for a QR code. Use ${canShare ? `Share ${what}` : 'Copy link'}.`
					: 'Making the link…'}
			</p>
		{/if}
	</div>
	<!-- One line either way, so the dialog never changes size when the code arrives. -->
	<p class="code-line" data-testid="share-code">
		<span class="label">Code</span>
		{#if made?.code}
			<span class="digits" data-testid="share-digits">{formatDigitCode(made.code)}</span>
		{:else}
			<span class="none">None</span>
		{/if}
	</p>
	{#snippet actions()}
		<Button variant="quiet" onclick={deleteCode} disabled={!made?.canDelete}>Delete code</Button>
		<Button variant="accent" onclick={() => made && copy(made.url)} disabled={!made}
			>Copy link</Button
		>
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
	.code-line {
		margin: var(--space-3) 0 0;
		min-height: 1lh;
		display: flex;
		justify-content: center;
		align-items: baseline;
		gap: var(--space-2);
		font-size: 1.6rem;
	}
	.label {
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
	.digits {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.1em;
	}
	.none {
		color: var(--on-surface-muted);
	}
</style>

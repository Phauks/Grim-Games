<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import SharePanel from '#lib/ui/share/SharePanel.svelte';
	import ScriptByline from '#lib/features/player/ScriptByline.svelte';
	import ScriptLogo from './ScriptLogo.svelte';
	import type { ShareTarget } from './share-codes.ts';

	/**
	 * Sharing a script's link on the one share screen (`ui/share/SharePanel`). No code to
	 * type: codes are only for joining a game (Trevor, 2026-10-16). The link is made when
	 * this appears (it lives inside a dialog), so nothing is uploaded just by opening a page.
	 */
	interface Props {
		/** Shown in the share sheet and the QR code's name, e.g. the script's name. */
		title: string;
		/** Under the name, when the script says (Trevor, 2026-10-18). */
		author?: string;
		version?: string;
		/**
		 * The script's logo, drawn in the middle of the QR code; without one (or if it fails to
		 * load) the script's name is, in the headings font (Trevor, 2026-10-19).
		 */
		logo?: string;
		/** Makes the link. */
		target: () => Promise<ShareTarget>;
	}

	let { title, author, version, logo, target }: Props = $props();
	let logoFailed = $state(false);
	$effect(() => {
		void logo;
		logoFailed = false;
	});
	const showLogo = $derived(!!logo && !logoFailed);
	let made = $state.raw<ShareTarget | undefined>();
	let failed = $state(false);

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
</script>

<div class="panel">
	<ScriptByline {author} {version} />
	<SharePanel
		url={made?.url}
		{title}
		qrLabel={t('scripts.share.qr', { title })}
		pending={failed ? t('scripts.share.failed') : t('scripts.share.making')}
		qrCenterShape={showLogo ? 'square' : 'wide'}
	>
		{#snippet qrCenter()}
			{#if showLogo}
				<ScriptLogo src={logo} class="qr-logo" onfail={() => (logoFailed = true)} />
			{:else}
				<span class="qr-name" data-testid="qr-name">{title}</span>
			{/if}
		{/snippet}
	</SharePanel>
</div>

<style>
	.panel {
		margin-top: var(--space-3);
	}
	.panel :global(.qr-logo) {
		width: 100%;
		height: 100%;
	}
	/* Sized by the middle's own height, at most two lines. */
	.qr-name {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		color: var(--on-token);
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
		font-size: 34cqh;
		line-height: 1.1;
		text-align: center;
		overflow-wrap: anywhere;
	}
</style>

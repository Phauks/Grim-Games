<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import { copyText } from '#lib/ui/clipboard.ts';
	import { downloadFile, fileNameFor } from '#lib/ui/download.ts';
	import { recapHtml } from './recap-html.ts';
	import { isRecapId, type SharedRecap } from './recap-share-api.ts';
	import { fetchSharedRecap, type RecapFetchError } from './recap-share.ts';

	/**
	 * A game recap the Storyteller shared (ShareRecapDialog), opened on a player's phone from
	 * the link or QR code. It shows the same file Save keeps, so what a player saves, texts
	 * or shares is what they saw (Trevor, 2026-10-19: "this could then be saved or texted or
	 * shared").
	 */
	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	let shared = $state<SharedRecap>();
	let problem = $state<RecapFetchError>();

	const PROBLEMS = {
		gone: 'history.recapGone',
		busy: 'history.recapBusy',
		offline: 'history.recapOffline',
		damaged: 'history.recapDamaged'
	} as const satisfies Record<RecapFetchError, string>;

	$effect(() => {
		if (!isRecapId(id)) {
			problem = 'gone';
			return;
		}
		let current = true;
		fetchSharedRecap(id).then((result) => {
			if (!current) return;
			if (typeof result === 'string') problem = result;
			else shared = result;
		});
		return () => (current = false);
	});

	const html = $derived(shared && recapHtml(shared.recap, shared.parts, shared.image));
	const fileName = $derived(
		shared ? fileNameFor(`${shared.recap.title} ${shared.recap.played}`, 'game', 'html') : ''
	);

	function save() {
		if (html) downloadFile(fileName, html, 'text/html');
	}

	/** The file itself where the phone can share files, else the link, else a copy of it. */
	async function share() {
		if (!html || !shared) return;
		const title = shared.recap.title;
		const file = new File([html], fileName, { type: 'text/html' });
		try {
			if (navigator.canShare?.({ files: [file] })) {
				await navigator.share({ title, files: [file] });
			} else if (typeof navigator.share === 'function') {
				await navigator.share({ title, url: location.href });
			} else {
				await copyText(location.href, {
					failed: [t('share.copyFailed'), t('share.copyFailedHint')]
				});
			}
		} catch (e) {
			// Closing the share sheet is not a failure.
			if (!(e instanceof DOMException && e.name === 'AbortError')) save();
		}
	}

	/** The file sits in a frame as tall as its content, so the page scrolls, not the frame. */
	let frameHeight = $state(0);
	function fit(frame: HTMLIFrameElement) {
		const measure = () => {
			const body = frame.contentDocument?.documentElement;
			if (body) frameHeight = body.scrollHeight;
		};
		frame.addEventListener('load', measure);
		const observer = new ResizeObserver(measure);
		observer.observe(frame);
		return () => {
			frame.removeEventListener('load', measure);
			observer.disconnect();
		};
	}
</script>

{#snippet actions()}
	<IconButton icon="download" label={t('history.recapSave')} disabled={!html} onclick={save} />
	<IconButton icon="share" label={t('history.recapShare')} disabled={!html} onclick={share} />
{/snippet}

<Page title={shared?.recap.title ?? t('history.recapTitle')} {actions}>
	{#if problem}
		<p role="alert">{t(PROBLEMS[problem])}</p>
	{:else if !html}
		<p aria-busy="true">{t('history.recapLoading')}</p>
	{:else}
		<!-- The recap's own page, with no scripts: every text in it was escaped (recap-html.ts). -->
		<iframe
			class="recap"
			title={t('history.recapTitle')}
			srcdoc={html}
			sandbox="allow-same-origin"
			style:height={frameHeight ? `${frameHeight}px` : undefined}
			{@attach fit}
			data-testid="recap-frame"
		></iframe>
	{/if}
</Page>

<style>
	.recap {
		display: block;
		width: 100%;
		min-height: 60vh;
		border: 0;
		border-radius: var(--radius-md);
	}
</style>

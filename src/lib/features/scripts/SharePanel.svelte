<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import SharePanel from '#lib/ui/share/SharePanel.svelte';
	import ScriptByline from '#lib/features/player/ScriptByline.svelte';
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
		/** Makes the link. */
		target: () => Promise<ShareTarget>;
	}

	let { title, author, version, target }: Props = $props();
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
	/>
</div>

<style>
	.panel {
		margin-top: var(--space-3);
	}
</style>

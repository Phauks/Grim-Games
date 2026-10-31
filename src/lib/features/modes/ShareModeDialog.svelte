<script lang="ts">
	import type { GameMode, SpecialRule } from '#lib/core/modes/index.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { downloadFile, fileNameFor } from '#lib/ui/download.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import SharePanel from '#lib/ui/share/SharePanel.svelte';
	import { modeFileText, modeShareLink } from './mode-share.ts';

	/**
	 * Shares a mode file someone added (Trevor, 2026-10-31: as scripts, characters and character
	 * collections are shared): the one share screen, with a link that opens New game holding
	 * the file (mode-share.ts), and the file itself where the phone can send files.
	 */
	interface Props {
		open: boolean;
		mode: GameMode | SpecialRule | undefined;
	}

	let { open = $bindable(), mode }: Props = $props();

	let url = $state<string>();
	const fileName = $derived(mode ? fileNameFor(mode.name, mode.id) : 'mode.json');
	const file = $derived(
		mode ? new File([modeFileText(mode)], fileName, { type: 'application/json' }) : undefined
	);

	$effect(() => {
		url = undefined;
		if (!open || !mode) return;
		let current = true;
		modeShareLink(location.origin, mode)
			.then((link) => {
				if (current) url = link;
			})
			.catch((error) => reportError(error, { area: 'modes' }));
		return () => (current = false);
	});
</script>

<Dialog bind:open title={t('modes.share.title', { name: mode?.name ?? '' })}>
	<SharePanel
		{url}
		title={mode?.name ?? ''}
		qrLabel={t('modes.share.qr', { name: mode?.name ?? '' })}
		pending={t('modes.share.making')}
		{file}
		onFileFailed={() => mode && downloadFile(fileName, modeFileText(mode))}
	/>
</Dialog>

<script lang="ts">
	// Copy and Download as icons beside the Advanced heading (Trevor, 2026-10-19). The panel
	// gathers the diagnostics each time About opens, so a separate Refresh is not needed.
	import type { MessageKey } from '#lib/i18n/catalog.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { copyText } from '#lib/ui/clipboard.ts';
	import { downloadFile } from '#lib/ui/download.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { diagnosticsFileName, diagnosticsText } from './diagnostics.ts';
	import { diagnosticsView, refreshDiagnostics } from './diagnostics-view.svelte.ts';

	const label = (key: MessageKey) => (t as (key: MessageKey) => string)(key);

	/** The gathered diagnostics, gathering them first only if the panel has not yet. */
	async function current() {
		if (!diagnosticsView.current) await refreshDiagnostics();
		return diagnosticsView.current;
	}

	async function copy() {
		const diagnostics = await current();
		if (!diagnostics) return;
		await copyText(diagnosticsText(diagnostics, label), {
			copied: [t('errors.copied'), t('errors.diag.copiedDetail')],
			failed: [t('errors.copyFailed'), t('errors.copyFailedDetail')]
		});
	}

	async function download() {
		const diagnostics = await current();
		if (!diagnostics) return;
		downloadFile(
			diagnosticsFileName(diagnostics.gatheredAt),
			diagnosticsText(diagnostics, label),
			'text/plain'
		);
	}
</script>

<span class="actions">
	<IconButton icon="copy" label={t('errors.diag.copy')} onclick={() => void copy()} />
	<IconButton icon="download" label={t('errors.diag.download')} onclick={() => void download()} />
</span>

<style>
	/* Side by side on the heading's line. */
	.actions {
		display: flex;
		gap: var(--space-1);
	}
</style>

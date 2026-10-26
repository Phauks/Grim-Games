<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { downloadBlob, downloadFile, fileNameFor } from '#lib/ui/download.ts';
	import { dataUrl } from '#lib/ui/screenshot.ts';
	import { buildRecap, type RecapSource } from './recap.ts';
	import { recapHtml, type RecapParts } from './recap-html.ts';
	import ShareRecapDialog from './ShareRecapDialog.svelte';

	/**
	 * Saves a finished game (Trevor, 2026-10-19): one HTML file with the history log, the
	 * final grimoire and the Storyteller's notes, each part chosen here, or the grimoire on
	 * its own as a PNG. The board's ⋯ menu and History open it, and Share passes the game on
	 * to the players' phones (ShareRecapDialog). Only the board opens it (History goes to the
	 * board first, EXPORT_HASH), so the grimoire is a screenshot of the board itself (Trevor,
	 * 2026-10-26: no separately drawn copy to keep up to date).
	 */
	interface Props {
		open: boolean;
		/** The game to save, as it was when it ended. */
		load: () => Promise<RecapSource>;
		/** The board's picture as it is on screen. */
		capture: (type?: 'image/png' | 'image/jpeg') => Promise<Blob>;
	}

	let { open = $bindable(), load, capture }: Props = $props();

	let parts = $state<RecapParts>({ log: true, image: true, notes: true });
	let busy = $state(false);
	let shareOpen = $state(false);

	function openShare() {
		open = false;
		shareOpen = true;
	}

	async function run(what: 'recap' | 'image') {
		busy = true;
		try {
			const recap = buildRecap(await load());
			if (what === 'image') {
				downloadBlob(fileNameFor(recap.title, 'grimoire', 'png'), await capture());
			} else {
				const image = parts.image ? await dataUrl(await capture()) : undefined;
				downloadFile(
					fileNameFor(`${recap.title} ${recap.played}`, 'game', 'html'),
					recapHtml(recap, parts, image),
					'text/html'
				);
			}
		} catch (error) {
			reportError(error, { area: 'history' });
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open title={t('history.exportTitle')}>
	<div class="parts" data-testid="export-parts">
		<Toggle
			label={t('history.exportLog')}
			checked={parts.log}
			onChange={(on) => (parts.log = on)}
		/>
		<Toggle
			label={t('history.exportImage')}
			checked={parts.image}
			onChange={(on) => (parts.image = on)}
		/>
		<Toggle
			label={t('history.exportNotes')}
			checked={parts.notes}
			onChange={(on) => (parts.notes = on)}
		/>
	</div>
	{#snippet actions()}
		<Button icon="share" variant="quiet" disabled={busy} onclick={openShare}>
			{t('history.exportShare')}
		</Button>
		<Button icon="grimoire" variant="quiet" disabled={busy} onclick={() => run('image')}>
			{t('history.exportPicture')}
		</Button>
		<Button icon="download" disabled={busy} onclick={() => run('recap')}
			>{t('history.exportDownload')}</Button
		>
	{/snippet}
</Dialog>

<ShareRecapDialog bind:open={shareOpen} {load} {capture} />

<style>
	.parts {
		display: grid;
	}
</style>

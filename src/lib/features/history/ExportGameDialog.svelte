<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { dataUrl, grimoireImage } from '#lib/features/grimoire/grimoire-image.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { downloadBlob, downloadFile, fileNameFor } from '#lib/ui/download.ts';
	import type { SeatLayout } from '#lib/ui/seating/seat-layout.ts';
	import { buildRecap, type RecapSource } from './recap.ts';
	import { recapHtml, type RecapParts } from './recap-html.ts';

	/**
	 * Saves a finished game (Trevor, 2026-10-19): one HTML file with the history log, the
	 * final grimoire and the Storyteller's notes, each part chosen here, or the grimoire on
	 * its own as a PNG. The board's ⋯ menu and History open it.
	 */
	interface Props {
		open: boolean;
		/** The game to save: loaded when asked, so History needn't open every game. */
		load: () => Promise<{ source: RecapSource; layout: SeatLayout }>;
	}

	let { open = $bindable(), load }: Props = $props();

	let parts = $state<RecapParts>({ log: true, image: true, notes: true });
	let busy = $state(false);

	async function picture(source: RecapSource, layout: SeatLayout, caption: string) {
		await document.fonts?.ready;
		return grimoireImage(source.game, source.characters, layout, caption);
	}

	async function run(what: 'recap' | 'image') {
		busy = true;
		try {
			const { source, layout } = await load();
			const recap = buildRecap(source);
			const caption = `${recap.title} · ${recap.result}`;
			if (what === 'image') {
				downloadBlob(
					fileNameFor(recap.title, 'grimoire', 'png'),
					await picture(source, layout, caption)
				);
			} else {
				const image = parts.image
					? await dataUrl(await picture(source, layout, caption))
					: undefined;
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
		<Button icon="grimoire" variant="quiet" disabled={busy} onclick={() => run('image')}>
			{t('history.exportPicture')}
		</Button>
		<Button icon="download" disabled={busy} onclick={() => run('recap')}
			>{t('history.exportDownload')}</Button
		>
	{/snippet}
</Dialog>

<style>
	.parts {
		display: grid;
	}
</style>

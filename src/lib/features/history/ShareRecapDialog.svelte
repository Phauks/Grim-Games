<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import ScriptQrCenter from '#lib/features/scripts/ScriptQrCenter.svelte';
	import { fromScript, scriptLogo } from '#lib/core/data/index.ts';
	import type { GameId } from '#lib/core/model/types.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import SharePanel from '#lib/ui/share/SharePanel.svelte';
	import { dataUrl } from '#lib/ui/screenshot.ts';
	import { buildRecap, type RecapSource } from './recap.ts';
	import type { RecapParts } from './recap-html.ts';
	import { recapPagePath, sharedRecap } from './recap-share-api.ts';
	import { deleteRecap, recapShares, uploadRecap, type RecapShare } from './recap-share.ts';

	/**
	 * Shares a finished game's recap with the players (Trevor, 2026-10-19: "something that
	 * people who are playing the game could see as well on their phones if the storyteller
	 * allows (allow them to denote what information to share)"). The Storyteller picks the
	 * parts, with their notes off to begin with, and the players open the link or QR code.
	 * The parts are fixed once shared: Stop sharing deletes it, and it can be shared again.
	 */
	interface Props {
		open: boolean;
		load: () => Promise<RecapSource>;
		/** The board's picture as it is on screen (screenshot.ts). */
		capture: (type?: 'image/png' | 'image/jpeg') => Promise<Blob>;
	}

	let { open = $bindable(), load, capture }: Props = $props();

	let parts = $state<RecapParts>({ log: true, image: true, notes: false });
	let gameId = $state<GameId>();
	let title = $state('');
	let share = $state<RecapShare>();
	let busy = $state(false);
	let failed = $state(false);
	let confirmStop = $state(false);
	/** The script's logo, in the middle of the QR code (Trevor, 2026-10-19). */
	let logo = $state<string>();
	let logoFailed = $state(false);

	const url = $derived(share ? `${location.origin}${recapPagePath(share.id)}` : undefined);

	$effect(() => {
		if (!open) return;
		let current = true;
		load()
			.then((source) => {
				if (!current) return;
				gameId = source.game.gameId;
				title = buildRecap(source).title;
				share = recapShares.read(gameId);
				if (share) parts = { ...share.parts };
				return loadOfficialData().then((data) => {
					if (current) logo = scriptLogo(fromScript(source.game.script, data).script);
				});
			})
			.catch((error) => reportError(error, { area: 'history' }));
		return () => (current = false);
	});

	async function start() {
		busy = true;
		failed = false;
		try {
			const source = await load();
			const recap = buildRecap(source);
			title = recap.title;
			let image: string | undefined;
			// A JPEG keeps a shared recap to a few hundred KB.
			if (parts.image) image = await dataUrl(await capture('image/jpeg'));
			const created = await uploadRecap(sharedRecap(recap, parts, image));
			share = { ...created, parts: { ...parts }, at: Date.now() };
			recapShares.write(source.game.gameId, share);
		} catch {
			// Offline, or the server refused: the Storyteller can try again.
			failed = true;
		} finally {
			busy = false;
		}
	}

	async function stop() {
		if (!share || !gameId) return;
		busy = true;
		try {
			await deleteRecap(share);
			recapShares.remove(gameId);
			share = undefined;
		} catch (error) {
			reportError(error, { area: 'history' });
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open title={t('history.shareTitle')}>
	<div class="layout">
		<div class="parts" data-testid="share-parts">
			<Toggle
				label={t('history.exportLog')}
				checked={parts.log}
				disabled={!!share || busy}
				onChange={(on) => (parts.log = on)}
			/>
			<Toggle
				label={t('history.exportImage')}
				checked={parts.image}
				disabled={!!share || busy}
				onChange={(on) => (parts.image = on)}
			/>
			<Toggle
				label={t('history.exportNotes')}
				checked={parts.notes}
				disabled={!!share || busy}
				onChange={(on) => (parts.notes = on)}
			/>
		</div>
		<SharePanel
			{url}
			{title}
			qrLabel={t('history.shareQr')}
			qrCenterShape={logo && !logoFailed ? 'square' : 'wide'}
			pending={failed
				? t('history.shareFailed')
				: busy
					? t('history.sharing')
					: t('history.notShared')}
		>
			{#snippet qrCenter()}
				<ScriptQrCenter {logo} name={title} bind:failed={logoFailed} />
			{/snippet}
			{#snippet actions()}
				{#if share}
					<DeleteButton
						label={t('history.stopSharing')}
						disabled={busy}
						onclick={() => (confirmStop = true)}
					/>
				{:else}
					<Button variant="accent" icon="share" disabled={busy || !gameId} onclick={start}>
						{t('history.shareButton')}
					</Button>
				{/if}
			{/snippet}
		</SharePanel>
	</div>
</Dialog>

<ConfirmDialog
	bind:open={confirmStop}
	title={t('history.stopSharingTitle')}
	description={t('history.stopSharingText')}
	danger
	onConfirm={stop}
/>

<style>
	.layout {
		display: grid;
		gap: var(--space-3);
	}
	.parts {
		display: grid;
	}
</style>

<script lang="ts">
	import { buildInfo as info } from '#lib/build-info.ts';
	import { REPOSITORY_URL, shortCommit } from '#lib/features/about/report-issue.ts';
	import OfficialNotice from '#lib/features/about/OfficialNotice.svelte';
	import UpdateChanges from '#lib/features/about/UpdateChanges.svelte';
	import { updateCheck } from '#lib/features/about/update-check.svelte.ts';
	import DiagnosticsPanel from '#lib/features/errors/DiagnosticsPanel.svelte';
	import { diagnosticsText } from '#lib/features/errors/diagnostics.ts';
	import {
		diagnosticsView,
		refreshDiagnostics
	} from '#lib/features/errors/diagnostics-view.svelte.ts';
	import { reportDialog } from '#lib/features/reports/report-dialog.svelte.ts';
	import type { MessageKey } from '#lib/i18n/catalog.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import DiagnosticsActions from '#lib/features/errors/DiagnosticsActions.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import { ADVANCED_KEY } from './about-advanced.ts';
	import { formatBytes } from '#lib/i18n/bytes.ts';
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';

	const RESULT = {
		idle: '',
		checking: 'shell.updateChecking',
		downloading: 'shell.updateDownloading',
		current: 'shell.updateCurrent',
		ready: 'shell.updateFound',
		failed: 'shell.updateCheckFailed',
		unsupported: 'shell.updateUnsupported'
	} as const;
	const result = $derived(RESULT[updateCheck.result]);

	// What the waiting build changed, here as on the update card, so About need not be left to
	// see it (Trevor, 2026-10-19). In a dialog, so the version line never grows.
	let changesOpen = $state(false);
	$effect(() => {
		if (updateCheck.ready) void updateCheck.loadChanges();
	});

	// Report an issue sits in About itself, not in Advanced (Trevor, 2026-10-19), and still
	// attaches this device's diagnostics, gathering them first when Advanced was never opened.
	async function report() {
		if (!diagnosticsView.current) await refreshDiagnostics();
		const diagnostics = diagnosticsView.current;
		const label = (key: MessageKey) => (t as (key: MessageKey) => string)(key);
		reportDialog.show({
			kind: 'bug',
			details: diagnostics ? diagnosticsText(diagnostics, label) : undefined
		});
	}

	// "Checked 18:58" today, with the date on other days.
	function checkedText(at: number): string {
		const today = new Date().toDateString() === new Date(at).toDateString();
		const time = intl.date(
			at,
			today ? { timeStyle: 'short' } : { dateStyle: 'medium', timeStyle: 'short' }
		);
		return t('shell.updateCheckedAt', { time });
	}
	// While a check runs, only where it has got: checking, then the download (Trevor,
	// 2026-10-18: "give status of download"), then the usual "Checked … · Update ready".
	const status = $derived(
		updateCheck.result === 'checking'
			? t('shell.updateChecking')
			: updateCheck.result === 'downloading'
				? updateCheck.percent === undefined
					? t('shell.updateDownloading')
					: updateCheck.bytes
						? // Sizes too (Trevor, 2026-10-18): "2.4 MB of 6.1 MB · 39%".
							t('shell.updateDownloadingSize', {
								done: formatBytes(updateCheck.bytes.done),
								total: formatBytes(updateCheck.bytes.total),
								percent: intl.number(updateCheck.percent / 100, { style: 'percent' })
							})
						: t('shell.updateDownloadingPercent', {
								percent: intl.number(updateCheck.percent / 100, { style: 'percent' })
							})
				: [updateCheck.checkedAt ? checkedText(updateCheck.checkedAt) : '', result ? t(result) : '']
						.filter(Boolean)
						.join(' · ')
	);
</script>

<!-- The one About in the app (Trevor, 2026-10-16: About lives in Settings; 2026-10-18: only there, not the footer). -->
<p>{t('shell.aboutIntro')}</p>
<dl>
	<dt>{t('shell.aboutVersion')}</dt>
	<!-- Check for updates sits small beside the version, with when it last checked and the
	     result on the same line, cut off rather than wrapped so nothing moves (Trevor, 2026-10-18). -->
	<dd class="version">
		<span>{info.version}</span>
		<IconButton
			icon="refresh"
			label={t('shell.checkUpdates')}
			disabled={updateCheck.result === 'checking' || updateCheck.result === 'downloading'}
			onclick={() => void updateCheck.check()}
		/>
		<span class="result" role="status" data-testid="update-check-result">{status}</span>
		<!-- Once a build is ready, Refresh moves onto it here too (Trevor, 2026-10-19). It takes the
		     end of the same line, as tall as the check button, so only the status text gets shorter. -->
		{#if updateCheck.ready}
			<IconButton
				icon="history"
				label={t('shell.whatChanged')}
				disabled={!updateCheck.changes}
				onclick={() => (changesOpen = true)}
			/>
			<Button
				variant="accent"
				data-testid="update-refresh"
				onclick={() => void updateCheck.refresh()}>{t('shell.updateRefresh')}</Button
			>
		{/if}
	</dd>
	<dt>{t('shell.aboutCommit')}</dt>
	<dd>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href="{REPOSITORY_URL}/commit/{info.commit}" target="_blank" rel="noopener"
			>{shortCommit(info)}</a
		>
	</dd>
</dl>
{#if updateCheck.changes}
	<Dialog bind:open={changesOpen} title={t('shell.whatChanged')}>
		<UpdateChanges changes={updateCheck.changes} />
	</Dialog>
{/if}
<div class="report">
	<Button onclick={() => void report()}><Icon name="report" />{t('errors.diag.report')}</Button>
</div>
<OfficialNotice />
<!-- Diagnostics, closed beneath About (Trevor, 2026-10-18); the version and commit show once,
     above, though the copied diagnostics still carry them. /diagnostics opens it. -->
<PageSection
	title={t('shell.aboutAdvanced')}
	level={3}
	collapsible
	storageKey={ADVANCED_KEY}
	defaultOpen={false}
>
	{#snippet aside()}<DiagnosticsActions />{/snippet}
	<DiagnosticsPanel hideRows={['errors.diag.version', 'errors.diag.commit']} />
</PageSection>

<style>
	p {
		margin: var(--space-3) 0;
	}
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: calc(0.25 * var(--u)) calc(1 * var(--u));
	}
	dt {
		color: var(--on-surface-muted);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	dd a {
		color: inherit;
	}
	dt:has(+ .version) {
		align-self: center;
	}
	.version {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.result {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
	.report {
		margin-top: var(--space-3);
	}
</style>

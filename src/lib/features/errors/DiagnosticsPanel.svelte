<script lang="ts">
	import { copyText } from '#lib/ui/clipboard.ts';
	import { downloadFile } from '#lib/ui/download.ts';
	import { onMount } from 'svelte';
	import { reportDialog } from '#lib/features/reports/report-dialog.svelte.ts';
	import type { MessageKey } from '#lib/i18n/catalog.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { diagnosticsFileName, diagnosticsText } from './diagnostics.ts';
	import { diagnosticsView, refreshDiagnostics } from './diagnostics-view.svelte.ts';
	import { errorLog } from './report.svelte.ts';

	// Gathered on this device when the page opens; nothing is sent unless the person taps Report.

	interface Props {
		/** Rows already shown nearby (About's version and commit); still in the copied text. */
		hideRows?: readonly MessageKey[];
	}

	let { hideRows = [] }: Props = $props();

	const diagnostics = $derived(diagnosticsView.current);
	const label = (key: MessageKey) => (t as (key: MessageKey) => string)(key);
	const text = $derived(diagnostics ? diagnosticsText(diagnostics, label) : '');

	onMount(refreshDiagnostics);

	async function copy() {
		await copyText(text, {
			copied: [t('errors.copied'), t('errors.diag.copiedDetail')],
			failed: [t('errors.copyFailed'), t('errors.copyFailedDetail')]
		});
	}

	function download() {
		if (!diagnostics) return;
		downloadFile(diagnosticsFileName(diagnostics.gatheredAt), text, 'text/plain');
	}
</script>

<div class="panel" data-testid="diagnostics" aria-busy={!diagnostics}>
	<div class="actions">
		<Button variant="accent" disabled={!diagnostics} onclick={copy}>{t('errors.diag.copy')}</Button>
		<Button disabled={!diagnostics} onclick={download}>{t('errors.diag.download')}</Button>
		<Button
			disabled={!diagnostics}
			onclick={() => reportDialog.show({ kind: 'bug', details: text })}
		>
			<Icon name="report" />{t('errors.diag.report')}
		</Button>
	</div>

	<section>
		<h2>{t('errors.diag.problems')}</h2>
		<div class="row-line">
			<span>
				{errorLog.entries.length === 0
					? t('common.none')
					: t('errors.diag.problemCount', { count: errorLog.entries.length })}
			</span>
			<Button
				variant="quiet"
				disabled={errorLog.entries.length === 0}
				onclick={() => errorLog.showDetails()}>{t('errors.details')}</Button
			>
		</div>
	</section>

	{#each diagnostics?.sections ?? [] as section (section.id)}
		<section data-section={section.id}>
			<h2>{label(section.title)}</h2>
			<dl>
				{#each section.rows.filter((row) => !hideRows.includes(row.label)) as row (row.label)}
					<dt>{label(row.label)}</dt>
					<dd>
						{#if row.href}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external GitHub link -->
							<a href={row.href} target="_blank" rel="noopener">{row.value}</a>
						{:else}
							{row.value}
						{/if}
					</dd>
				{/each}
			</dl>
		</section>
	{/each}
</div>

<style>
	.panel {
		display: grid;
		gap: var(--space-4);
	}
	.actions,
	.row-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.row-line {
		justify-content: space-between;
	}
	section {
		display: grid;
		gap: var(--space-2);
	}
	h2 {
		margin: 0;
		font-size: 1rem;
	}
	dl {
		display: grid;
		grid-template-columns: minmax(8rem, max-content) 1fr;
		gap: var(--space-1) var(--space-3);
		margin: 0;
		font-size: 0.85rem;
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
</style>

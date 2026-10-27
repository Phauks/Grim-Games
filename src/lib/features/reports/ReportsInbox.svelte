<script lang="ts">
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import { onMount } from 'svelte';
	import { locale, t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { openAccount } from '#lib/features/shell/shell.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import DataTable, { type DataColumn } from '#lib/ui/table/DataTable.svelte';
	import { applyFilters, type ColumnFilter } from '#lib/ui/table/column-filter.ts';
	import type { MessageKey } from '#lib/i18n/catalog.ts';
	import { copyText } from '#lib/ui/clipboard.ts';
	import JsonDialog from '#lib/ui/builder/JsonDialog.svelte';
	import { downloadFile, fileNameFor } from '#lib/ui/download.ts';
	import {
		reportMarkdown,
		reportFileName,
		reportsFileName,
		reportsMarkdown,
		type ExportedReport
	} from './report-export.ts';
	import { deleteReport, fetchReportScript, listReports, setReportStatus } from './reports-api.ts';
	import { REPORT_STATUSES, type Report, type ReportStatus } from './reports-protocol.ts';

	// In-app reports, at /reports. Admin accounts triage them (Trevor, 2026-10-18; no admin key
	// since 2026-10-22). Any other signed-in account reads the reports sent from an account and
	// filters them by who sent them (Trevor, 2026-10-19). The Worker decides what each may see.

	/**
	 * How this device reads reports: still checking, signed out, a signed-in account that only
	 * reads, or an admin account.
	 */
	let access = $state<'checking' | 'none' | 'reader' | 'account'>('checking');
	const allowed = $derived(access === 'account');
	const reading = $derived(allowed || access === 'reader');
	let reports = $state<Report[]>();
	let columnFilters = $state<Partial<Record<Column, ColumnFilter>>>({});
	let openId = $state<number>();
	let dialogOpen = $state(false);
	let confirmDelete = $state(false);
	/** The open report's script, fetched when asked for: the list leaves scripts out. */
	let scriptJson = $state.raw<unknown[]>();
	let scriptOpen = $state(false);

	const current = $derived(reports?.find((r) => r.id === openId));
	const time = $derived(
		new Intl.DateTimeFormat(locale.current, { dateStyle: 'medium', timeStyle: 'short' })
	);
	const day = $derived(new Intl.DateTimeFormat(locale.current, { dateStyle: 'short' }));
	const statusOptions = $derived(
		REPORT_STATUSES.map((value) => ({ value, label: t(`reports.status.${value}`) }))
	);

	/** What the open report was sent with is kept from readers other than its sender. */
	const hidden = $derived(!allowed && !current?.mine);

	/** Who sent it: their username, or why there is none. */
	function reporter(report: Report): string {
		if (report.reporter) return report.reporter;
		return report.fromAccount ? t('reports.noUsername') : t('reports.signedOut');
	}

	type Column = 'id' | 'title' | 'kind' | 'reporter' | 'status' | 'sent';
	const columns = $derived<DataColumn<Column, Report>[]>([
		{ id: 'id', flush: true, label: '#', width: 'max(7%, 4.5rem)', wide: true, value: (r) => r.id },
		{
			id: 'title',
			flush: true,
			label: t('reports.summary'),
			rowHeader: true,
			value: (r) => r.title
		},
		{
			id: 'kind',
			flush: true,
			label: t('reports.kind'),
			width: '15%',
			wide: true,
			value: (r) => t(`reports.kind.${r.kind}`)
		},
		{
			id: 'reporter',
			flush: true,
			label: t('reports.reporter'),
			width: 'max(17%, 8.5rem)',
			value: reporter
		},
		{
			id: 'status',
			flush: true,
			label: t('reports.status'),
			width: 'max(12%, 7rem)',
			value: (r) => t(`reports.status.${r.status}`)
		},
		{
			id: 'sent',
			flush: true,
			label: t('reports.sentAt'),
			width: 'max(12%, 6.5rem)',
			wide: true,
			value: (r) => r.createdAt
		}
	]);

	/** The rows the table shows after its filters: what Copy and Download take. */
	const shown = $derived(
		applyFilters(reports ?? [], columnFilters, (r, id) =>
			columns.find((c) => c.id === id)?.value?.(r)
		)
	);

	const label = (key: MessageKey) => (t as (key: MessageKey) => string)(key);

	/** A report with what an export needs: who sent it and, when it has one, its script. */
	async function exported(report: Report): Promise<ExportedReport> {
		const script =
			report.hasScript && !(!allowed && !report.mine)
				? await fetchReportScript(report.id).catch(() => undefined)
				: undefined;
		return { report, reporter: reporter(report), ...(script ? { script } : {}) };
	}

	const copyFailed = [t('errors.copyFailed'), t('errors.copyFailedDetail')] as const;

	// Each report as Markdown to hand off (Trevor, 2026-10-27), with what it was sent with.
	async function copyReport(report: Report) {
		await copyText(reportMarkdown(await exported(report), label), {
			copied: [t('errors.copied'), t('reports.copiedDetail')],
			failed: copyFailed
		});
	}

	async function exportShown(): Promise<string> {
		const all = await Promise.all(shown.map(exported));
		return reportsMarkdown(all, label, Date.now());
	}

	async function copyShown() {
		const count = shown.length;
		await copyText(await exportShown(), {
			copied: [t('errors.copied'), t('reports.copiedAllDetail', { count })],
			failed: copyFailed
		});
	}

	/** One report as its own file (Trevor, 2026-10-27), beside its Copy. */
	async function downloadReport(report: Report) {
		downloadFile(
			reportFileName(report.id),
			`${reportMarkdown(await exported(report), label)}\n`,
			'text/markdown'
		);
	}

	async function downloadShown() {
		downloadFile(reportsFileName(Date.now()), await exportShown(), 'text/markdown');
	}

	onMount(() => void load());

	async function load() {
		try {
			const list = await listReports();
			reports = list?.reports;
			access = list === undefined ? 'none' : list.admin ? 'account' : 'reader';
			// Everyone starts on every report, with no filter on (Trevor, 2026-10-27).
		} catch {
			if (access === 'checking') access = 'none';
			toast(t('reports.loadFailed'), t('reports.sendFailedDetail'));
		}
	}

	async function changeStatus(report: Report, status: ReportStatus) {
		const before = report.status;
		report.status = status;
		try {
			await setReportStatus(report.id, status);
		} catch {
			report.status = before;
			toast(t('reports.loadFailed'), t('reports.sendFailedDetail'));
		}
	}

	async function openScript(report: Report) {
		try {
			scriptJson = await fetchReportScript(report.id);
			if (scriptJson) scriptOpen = true;
			else toast(t('reports.loadFailed'), t('reports.sendFailedDetail'));
		} catch {
			toast(t('reports.loadFailed'), t('reports.sendFailedDetail'));
		}
	}

	async function remove(report: Report) {
		try {
			await deleteReport(report.id);
			reports = reports?.filter((r) => r.id !== report.id);
			dialogOpen = false;
		} catch {
			toast(t('reports.loadFailed'), t('reports.sendFailedDetail'));
		}
	}
</script>

<!-- Refresh is always there, disabled until it applies, so nothing moves when the list appears.
     Who is an admin is set in Cloudflare and nothing to manage here; the Reporter column filters
     to yourself (Trevor, 2026-10-22). -->
<Page title={t('reports.inbox')}>
	{#snippet actions()}
		<IconButton
			icon="copy"
			label={t('reports.copyShown')}
			disabled={!reading || shown.length === 0}
			onclick={copyShown}
		/>
		<IconButton
			icon="download"
			label={t('reports.download')}
			disabled={!reading || shown.length === 0}
			onclick={downloadShown}
		/>
		<IconButton
			icon="refresh"
			label={t('errors.diag.refresh')}
			disabled={!reading}
			onclick={load}
		/>
	{/snippet}
	{#if access === 'checking'}
		<p class="none" aria-busy="true">{t('reports.checking')}</p>
	{:else if access === 'none'}
		<!-- Signed out: reports are read with an account. -->
		<div class="sign-in">
			<Button onclick={openAccount}>{t('account.signIn.title')}</Button>
		</div>
	{:else}
		<DataTable
			label={t('reports.inbox')}
			{columns}
			rows={reports ?? []}
			key={(r) => String(r.id)}
			bind:columnFilters
			narrow="hide"
			fit="container"
			hideKey="reports"
			pageSize={50}
			empty={t('common.none')}
			testid="reports"
		>
			{#snippet cell(report, column)}
				<!-- Every cell opens the same report, so a tap anywhere on the row does; only the
				     title is in the tab order. -->
				<button
					type="button"
					class="open"
					tabindex={column.id === 'title' ? undefined : -1}
					onclick={() => ((openId = report.id), (dialogOpen = true))}
				>
					{#if column.id === 'id'}
						#{report.id}
					{:else if column.id === 'title'}
						{report.title}
					{:else if column.id === 'kind'}
						{t(`reports.kind.${report.kind}`)}
					{:else if column.id === 'reporter'}
						{reporter(report)}
					{:else if column.id === 'status'}
						{t(`reports.status.${report.status}`)}
					{:else}
						{day.format(report.createdAt)}
					{/if}
				</button>
			{/snippet}
		</DataTable>
	{/if}
</Page>

<Dialog
	bind:open={dialogOpen}
	title={current ? `#${current.id} ${current.title}` : ''}
	description={current ? t(`reports.kind.${current.kind}`) : undefined}
	size="full"
>
	{#if current}
		<div class="report">
			<p class="body">{current.body}</p>
			<!-- Only admins change it; others see it in the same place, disabled. -->
			<Select
				label={t('reports.status')}
				value={current.status}
				options={statusOptions}
				disabled={!allowed}
				onChange={(v) => changeStatus(current, v)}
			/>
			<dl>
				<dt>{t('reports.reporter')}</dt>
				<dd>{reporter(current)}</dd>
				<dt>{t('reports.sentAt')}</dt>
				<dd>{time.format(current.createdAt)}</dd>
				<dt>{t('reports.contact')}</dt>
				<dd>{hidden ? t('reports.hidden') : (current.contact ?? t('common.none'))}</dd>
				<dt>{t('reports.page')}</dt>
				<dd>{hidden ? t('reports.hidden') : (current.page ?? t('common.none'))}</dd>
				<dt>{t('reports.build')}</dt>
				<dd>{hidden ? t('reports.hidden') : (current.build ?? t('common.none'))}</dd>
				<dt>{t('reports.device')}</dt>
				<dd>{hidden ? t('reports.hidden') : (current.device ?? t('common.none'))}</dd>
				<!-- The script it was sent from (Trevor, 2026-10-22), opened as its JSON. -->
				<dt>{t('reports.script')}</dt>
				<dd>
					{#if hidden}
						{t('reports.hidden')}
					{:else if current.hasScript}
						<Button variant="quiet" icon="script" onclick={() => openScript(current)}>
							{current.scriptName || t('reports.script')}
						</Button>
					{:else}
						{t('common.none')}
					{/if}
				</dd>
			</dl>
			{#if current.details}
				<h3>{t('reports.details')}</h3>
				<pre>{current.details}</pre>
			{/if}
		</div>
	{/if}
	{#snippet headActions()}
		<IconButton
			icon="copy"
			label={t('reports.copy')}
			disabled={!current}
			onclick={() => current && copyReport(current)}
		/>
		<IconButton
			icon="download"
			label={t('reports.downloadOne')}
			disabled={!current}
			onclick={() => current && downloadReport(current)}
		/>
		<DeleteButton
			label={t('reports.delete')}
			disabled={!allowed}
			onclick={() => (confirmDelete = true)}
		/>
	{/snippet}
</Dialog>

{#if scriptJson}
	<JsonDialog
		bind:open={scriptOpen}
		title={current?.scriptName || t('reports.script')}
		json={scriptJson}
		fileName={fileNameFor(current?.scriptName ?? '', 'script')}
		downloadLabel={t('script-builder.download')}
	/>
{/if}

<ConfirmDialog
	bind:open={confirmDelete}
	title={current ? t('reports.deleteTitle', { id: current.id }) : ''}
	description={t('reports.deleteDetail')}
	danger
	onConfirm={() => current && remove(current)}
/>

<style>
	.sign-in {
		padding: var(--space-2);
	}
	.open {
		width: 100%;
		height: 100%;
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		overflow-wrap: anywhere;
		cursor: pointer;
	}
	:global([data-testid='reports'] tr:has(.open:hover)) {
		background: var(--surface-hover);
	}
	.none {
		padding: var(--space-2);
		color: var(--on-surface-muted);
	}
	.report {
		display: grid;
		gap: var(--space-3);
	}
	.body {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		align-items: center;
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
	h3 {
		margin: 0;
		font-size: 1rem;
	}
	pre {
		margin: 0;
		overflow: auto;
		font-size: 0.75rem;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>

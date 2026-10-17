<script lang="ts">
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import { onMount } from 'svelte';
	import { locale, t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { deleteReport, listReports, setReportStatus } from './reports-api.ts';
	import { REPORT_STATUSES, type Report, type ReportStatus } from './reports-protocol.ts';

	// Trevor's inbox for in-app reports, at /reports (not in the menu). Reading needs the
	// Worker secret REPORTS_ADMIN_KEY, typed once and kept on this device only.

	const KEY_STORAGE = 'grim-games:reports-admin-key';
	type Filter = ReportStatus | 'all';

	let key = $state('');
	let typed = $state('');
	let wrongKey = $state(false);
	let reports = $state<Report[]>();
	let filter = $state<Filter>('new');
	let openId = $state<number>();
	let dialogOpen = $state(false);
	let confirmDelete = $state(false);

	const shown = $derived((reports ?? []).filter((r) => filter === 'all' || r.status === filter));
	const current = $derived(reports?.find((r) => r.id === openId));
	const time = $derived(
		new Intl.DateTimeFormat(locale.current, { dateStyle: 'medium', timeStyle: 'short' })
	);
	const statusOptions = $derived(
		REPORT_STATUSES.map((value) => ({ value, label: t(`reports.status.${value}`) }))
	);
	const filters = $derived([
		{ value: 'all' as Filter, label: t('reports.status.all') },
		...statusOptions
	]);

	onMount(() => {
		try {
			key = localStorage.getItem(KEY_STORAGE) ?? '';
		} catch {
			key = '';
		}
		if (key) void load();
	});

	async function load() {
		try {
			const list = await listReports(key);
			if (list === undefined) {
				wrongKey = true;
				forget();
				return;
			}
			reports = list;
		} catch {
			toast(t('reports.loadFailed'), t('reports.sendFailedDetail'));
		}
	}

	function useKey(event: Event) {
		event.preventDefault();
		if (!typed.trim()) return;
		key = typed.trim();
		typed = '';
		wrongKey = false;
		try {
			localStorage.setItem(KEY_STORAGE, key);
		} catch {
			// Storage blocked: the key lasts for this visit.
		}
		void load();
	}

	function forget() {
		key = '';
		reports = undefined;
		try {
			localStorage.removeItem(KEY_STORAGE);
		} catch {
			// Nothing stored.
		}
	}

	async function changeStatus(report: Report, status: ReportStatus) {
		const before = report.status;
		report.status = status;
		try {
			await setReportStatus(key, report.id, status);
		} catch {
			report.status = before;
			toast(t('reports.loadFailed'), t('reports.sendFailedDetail'));
		}
	}

	async function remove(report: Report) {
		try {
			await deleteReport(key, report.id);
			reports = reports?.filter((r) => r.id !== report.id);
			dialogOpen = false;
		} catch {
			toast(t('reports.loadFailed'), t('reports.sendFailedDetail'));
		}
	}
</script>

<!-- Refresh, Forget key and the status filter are always there, disabled until a key is in,
     so nothing moves when the list appears. -->
<Page title={t('reports.inbox')}>
	{#snippet actions()}
		<IconButton icon="refresh" label={t('errors.diag.refresh')} disabled={!key} onclick={load} />
		<Button variant="quiet" disabled={!key} onclick={forget}>{t('reports.forgetKey')}</Button>
	{/snippet}
	{#snippet toolbar()}
		<Segmented
			label={t('reports.status')}
			hideLabel
			disabled={!key}
			value={filter}
			options={filters}
			onChange={(v) => (filter = v)}
		/>
	{/snippet}
	{#if !key}
		<form class="key" onsubmit={useKey}>
			<label>
				<span>{wrongKey ? t('reports.wrongKey') : t('reports.adminKey')}</span>
				<ClearableField bind:value={typed}>
					<input type="password" bind:value={typed} autocomplete="off" />
				</ClearableField>
			</label>
		</form>
	{:else}
		<ul class="list" aria-busy={reports === undefined} data-testid="reports">
			{#each shown as report (report.id)}
				<li>
					<button
						type="button"
						class="row"
						onclick={() => ((openId = report.id), (dialogOpen = true))}
					>
						<span class="id">#{report.id}</span>
						<span class="kind">{t(`reports.kind.${report.kind}`)}</span>
						<span class="title">{report.title}</span>
						<span class="meta"
							>{t(`reports.status.${report.status}`)} · {time.format(report.createdAt)}</span
						>
					</button>
				</li>
			{:else}
				<li class="none">{t('common.none')}</li>
			{/each}
		</ul>
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
			<Select
				label={t('reports.status')}
				value={current.status}
				options={statusOptions}
				onChange={(v) => changeStatus(current, v)}
			/>
			<dl>
				<dt>{t('reports.sentAt')}</dt>
				<dd>{time.format(current.createdAt)}</dd>
				<dt>{t('reports.contact')}</dt>
				<dd>{current.contact ?? t('common.none')}</dd>
				<dt>{t('reports.page')}</dt>
				<dd>{current.page ?? t('common.none')}</dd>
				<dt>{t('reports.build')}</dt>
				<dd>{current.build ?? t('common.none')}</dd>
				<dt>{t('reports.device')}</dt>
				<dd>{current.device ?? t('common.none')}</dd>
			</dl>
			{#if current.details}
				<h3>{t('reports.details')}</h3>
				<pre>{current.details}</pre>
			{/if}
		</div>
	{/if}
	{#snippet headActions()}
		<DeleteButton label={t('reports.delete')} onclick={() => (confirmDelete = true)} />
	{/snippet}
</Dialog>

<ConfirmDialog
	bind:open={confirmDelete}
	title={current ? t('reports.deleteTitle', { id: current.id }) : ''}
	description={t('reports.deleteDetail')}
	danger
	onConfirm={() => current && remove(current)}
/>

<style>
	.key label {
		display: grid;
		gap: var(--space-1);
	}
	.list {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.row {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0 var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-2);
		border: 0;
		border-bottom: 1px solid var(--border);
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.row:hover {
		background: var(--surface-raised);
	}
	.id {
		grid-row: span 2;
		color: var(--on-surface-muted);
	}
	.kind,
	.meta {
		color: var(--on-surface-muted);
		font-size: 0.8rem;
	}
	.title {
		overflow-wrap: anywhere;
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

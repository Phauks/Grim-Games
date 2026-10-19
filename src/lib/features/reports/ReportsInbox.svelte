<script lang="ts">
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import { readStoredText, writeStoredText } from '#lib/ui/stored.ts';
	import { onMount } from 'svelte';
	import { locale, t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import DataTable, { type DataColumn } from '#lib/ui/table/DataTable.svelte';
	import type { ColumnFilter } from '#lib/ui/table/column-filter.ts';
	import {
		addAdmin,
		deleteReport,
		listAdmins,
		removeAdmin,
		listReports,
		setReportStatus
	} from './reports-api.ts';
	import {
		REPORT_STATUSES,
		type Admin,
		type Report,
		type ReportStatus
	} from './reports-protocol.ts';

	// In-app reports, at /reports. Admins triage them: a signed-in admin account (Trevor,
	// 2026-10-18), or the Worker secret REPORTS_ADMIN_KEY, typed once and kept on this device
	// only. Any other signed-in account reads the reports sent from an account and filters them
	// by who sent them (Trevor, 2026-10-19). The Worker decides what each may see.

	const KEY_STORAGE = 'grim-games:reports-admin-key';

	let key = $state('');
	/**
	 * How this device reads reports: still checking, not allowed, a signed-in account that only
	 * reads, an admin account, or the key.
	 */
	let access = $state<'checking' | 'none' | 'reader' | 'account' | 'key'>('checking');
	const allowed = $derived(access === 'account' || access === 'key');
	const reading = $derived(allowed || access === 'reader');
	let onlyMine = $state(false);
	let adminsOpen = $state(false);
	let admins = $state<Admin[]>();
	let newAdmin = $state('');
	let noAccount = $state(false);
	let typed = $state('');
	let keyForm = $state<HTMLFormElement>();
	let wrongKey = $state(false);
	let reports = $state<Report[]>();
	let columnFilters = $state<Partial<Record<Column, ColumnFilter>>>({});
	let openId = $state<number>();
	let dialogOpen = $state(false);
	let confirmDelete = $state(false);

	const shown = $derived((reports ?? []).filter((r) => !onlyMine || r.mine));
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

	onMount(() => {
		key = readStoredText(KEY_STORAGE) ?? '';
		void load();
	});

	async function load() {
		try {
			let list = await listReports(key);
			if (key && !list?.admin) {
				// A wrong or retired key: the account may still open the inbox.
				wrongKey = true;
				forget();
				list = await listReports('');
			}
			const first = access === 'checking' || access === 'none';
			reports = list?.reports;
			access = list === undefined ? 'none' : !list.admin ? 'reader' : key ? 'key' : 'account';
			// Admins start on the reports still to triage (as before), readers on all of them.
			if (first && allowed)
				columnFilters = { status: { kind: 'pick', values: [t('reports.status.new')] } };
		} catch {
			if (access === 'checking') access = 'none';
			toast(t('reports.loadFailed'), t('reports.sendFailedDetail'));
		}
	}

	async function openAdmins() {
		adminsOpen = true;
		try {
			admins = await listAdmins(key);
		} catch {
			toast(t('reports.loadFailed'), t('reports.sendFailedDetail'));
		}
	}

	async function changeAdmins(change: () => Promise<boolean | void>) {
		try {
			noAccount = (await change()) === false;
			if (!noAccount) newAdmin = '';
			admins = await listAdmins(key);
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
		// Storage blocked: the key lasts for this visit.
		writeStoredText(KEY_STORAGE, key);
		void load();
	}

	function forget() {
		key = '';
		reports = undefined;
		access = 'none';
		writeStoredText(KEY_STORAGE, undefined);
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

<!-- Refresh, Admins, Forget key and Only mine are always there, disabled until they apply,
     so nothing moves when the list appears. -->
<Page title={t('reports.inbox')}>
	{#snippet actions()}
		<IconButton
			icon="refresh"
			label={t('errors.diag.refresh')}
			disabled={!reading}
			onclick={load}
		/>
		<Button variant="quiet" disabled={!allowed} onclick={openAdmins}>{t('reports.admins')}</Button>
		<Button variant="quiet" disabled={access !== 'key'} onclick={forget}
			>{t('reports.forgetKey')}</Button
		>
	{/snippet}
	{#snippet toolbar()}
		<!-- Yourself as the reporter in one tap (Trevor, 2026-10-19); the Reporter column filters
		     by anyone. The key has no account, so it has no reports of its own. -->
		<Toggle
			label={t('reports.onlyMine')}
			checked={onlyMine}
			disabled={access !== 'reader' && access !== 'account'}
			onChange={(on) => (onlyMine = on)}
		/>
	{/snippet}
	{#if access === 'checking'}
		<p class="none" aria-busy="true">{t('reports.checking')}</p>
	{:else if access === 'none'}
		<form class="key" bind:this={keyForm} onsubmit={useKey}>
			<TextField
				label={wrongKey ? t('reports.wrongKey') : t('reports.adminKey')}
				bind:value={typed}
				type="password"
				oncommit={() => {
					keyForm?.requestSubmit();
					return false;
				}}
			/>
		</form>
	{:else}
		<DataTable
			label={t('reports.inbox')}
			{columns}
			rows={shown}
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
			</dl>
			{#if current.details}
				<h3>{t('reports.details')}</h3>
				<pre>{current.details}</pre>
			{/if}
		</div>
	{/if}
	{#snippet headActions()}
		<DeleteButton
			label={t('reports.delete')}
			disabled={!allowed}
			onclick={() => (confirmDelete = true)}
		/>
	{/snippet}
</Dialog>

<Dialog bind:open={adminsOpen} title={t('reports.admins')}>
	<ul class="admins" data-testid="admins">
		{#each admins ?? [] as { id, email } (id)}
			<li>
				<span>{email}</span>
				<DeleteButton
					label={t('reports.removeAdmin', { email })}
					onclick={() => changeAdmins(() => removeAdmin(key, id))}
				/>
			</li>
		{:else}
			<li class="none">{t('common.none')}</li>
		{/each}
	</ul>
	<TextField
		label={noAccount ? t('reports.noAccount') : t('reports.addAdmin')}
		type="email"
		autocomplete="off"
		bind:value={newAdmin}
		oncommit={() => {
			const email = newAdmin.trim();
			if (email) void changeAdmins(() => addAdmin(key, email));
			return false;
		}}
	/>
</Dialog>

<ConfirmDialog
	bind:open={confirmDelete}
	title={current ? t('reports.deleteTitle', { id: current.id }) : ''}
	description={t('reports.deleteDetail')}
	danger
	onConfirm={() => current && remove(current)}
/>

<style>
	.admins {
		display: grid;
		margin: 0 0 var(--space-3);
		padding: 0;
		list-style: none;
	}
	.admins li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		overflow-wrap: anywhere;
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

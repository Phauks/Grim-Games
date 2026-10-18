<script lang="ts">
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import { onMount } from 'svelte';
	import { locale, t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
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

	// Trevor's inbox for in-app reports, at /reports. Only a signed-in admin account opens it
	// (Trevor, 2026-10-18); the Worker checks.

	type Filter = ReportStatus | 'all';

	/** Whether this account reads reports: still checking, not allowed, or an admin. */
	let access = $state<'checking' | 'none' | 'admin'>('checking');
	const allowed = $derived(access === 'admin');
	let adminsOpen = $state(false);
	let admins = $state<Admin[]>();
	let newAdmin = $state('');
	let noAccount = $state(false);
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

	onMount(() => void load());

	async function load() {
		try {
			reports = await listReports();
			access = reports === undefined ? 'none' : 'admin';
		} catch {
			if (access === 'checking') access = 'none';
			toast(t('reports.loadFailed'), t('reports.sendFailedDetail'));
		}
	}

	async function openAdmins() {
		adminsOpen = true;
		try {
			admins = await listAdmins();
		} catch {
			toast(t('reports.loadFailed'), t('reports.sendFailedDetail'));
		}
	}

	async function changeAdmins(change: () => Promise<boolean | void>) {
		try {
			noAccount = (await change()) === false;
			if (!noAccount) newAdmin = '';
			admins = await listAdmins();
		} catch {
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

<!-- Refresh, Admins and the status filter are always there, disabled until the
     inbox opens, so nothing moves when the list appears. -->
<Page title={t('reports.inbox')}>
	{#snippet actions()}
		<IconButton
			icon="refresh"
			label={t('errors.diag.refresh')}
			disabled={!allowed}
			onclick={load}
		/>
		<Button variant="quiet" disabled={!allowed} onclick={openAdmins}>{t('reports.admins')}</Button>
	{/snippet}
	{#snippet toolbar()}
		<Select
			label={t('reports.status')}
			hideLabel
			disabled={!allowed}
			value={filter}
			options={filters}
			onChange={(v) => (filter = v)}
		/>
	{/snippet}
	{#if access === 'checking'}
		<p class="none" aria-busy="true">{t('reports.checking')}</p>
	{:else if access === 'none'}
		<p class="none">{t('reports.adminsOnly')}</p>
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

<Dialog bind:open={adminsOpen} title={t('reports.admins')}>
	<ul class="admins" data-testid="admins">
		{#each admins ?? [] as { id, email } (id)}
			<li>
				<span>{email}</span>
				<DeleteButton
					label={t('reports.removeAdmin', { email })}
					onclick={() => changeAdmins(() => removeAdmin(id))}
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
			if (email) void changeAdmins(() => addAdmin(email));
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

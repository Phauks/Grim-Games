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
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import {
		changeAdmin,
		deleteReport,
		listAdmins,
		listReports,
		setReportStatus
	} from './reports-api.ts';
	import { REPORT_STATUSES, type Report, type ReportStatus } from './reports-protocol.ts';

	// Trevor's inbox for in-app reports, at /reports (not in the menu). A signed-in admin
	// account opens it (Trevor, 2026-10-18); otherwise the Worker secret REPORTS_ADMIN_KEY,
	// typed once and kept on this device only. The Worker checks both.

	const KEY_STORAGE = 'grim-games:reports-admin-key';
	type Filter = ReportStatus | 'all';

	let key = $state('');
	/** How this device reads reports: still checking, not allowed, an admin account, or the key. */
	let access = $state<'checking' | 'none' | 'account' | 'key'>('checking');
	const allowed = $derived(access === 'account' || access === 'key');
	let adminsOpen = $state(false);
	let admins = $state<string[]>();
	let newAdmin = $state('');
	let typed = $state('');
	let keyForm = $state<HTMLFormElement>();
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
		key = readStoredText(KEY_STORAGE) ?? '';
		void load();
	});

	async function load() {
		try {
			let list = await listReports(key);
			if (list === undefined && key) {
				// A wrong or retired key: an admin account may still open the inbox.
				wrongKey = true;
				forget();
				list = await listReports('');
			}
			reports = list;
			access = list === undefined ? 'none' : key ? 'key' : 'account';
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

	async function setAdmin(email: string, add: boolean) {
		try {
			await changeAdmin(key, email, add);
			if (add) newAdmin = '';
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

<!-- Refresh, Admins, Forget key and the status filter are always there, disabled until the
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
		<Button variant="quiet" disabled={access !== 'key'} onclick={forget}
			>{t('reports.forgetKey')}</Button
		>
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
		{#each admins ?? [] as email (email)}
			<li>
				<span>{email}</span>
				<DeleteButton
					label={t('reports.removeAdmin', { email })}
					onclick={() => setAdmin(email, false)}
				/>
			</li>
		{:else}
			<li class="none">{t('common.none')}</li>
		{/each}
	</ul>
	<TextField
		label={t('reports.addAdmin')}
		type="email"
		autocomplete="off"
		bind:value={newAdmin}
		oncommit={() => {
			if (newAdmin.trim()) void setAdmin(newAdmin.trim(), true);
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

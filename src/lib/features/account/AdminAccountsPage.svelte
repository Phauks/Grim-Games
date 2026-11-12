<script lang="ts">
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import { openAccount } from '#lib/features/shell/shell.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import DataTable, { type DataColumn, type DataSort } from '#lib/ui/table/DataTable.svelte';
	import type { ColumnFilter } from '#lib/ui/table/column-filter.ts';
	import { account as me } from './account.svelte.ts';
	import { changeAccount, deleteAccount, listAccounts } from './admin-accounts-api.ts';
	import {
		firstAdminAccountDirection,
		orderAdminAccounts,
		type AdminAccount,
		type AdminAccountAction,
		type AdminAccountColumn as Column
	} from './admin-accounts-protocol.ts';

	// Accounts, at /accounts (plan S27, Trevor 2026-10-30): every account; tapping one opens its
	// details, where an admin acts on it. The Worker decides who may. A table like Live games
	// (Trevor, 2026-11-12), the most recently used first.

	/** Undefined until the list arrives, so "None" never shows while it loads. */
	let accounts = $state<AdminAccount[]>();
	let columnFilters = $state<Partial<Record<Column, ColumnFilter>>>({});
	let sort = $state<DataSort<Column>>({ column: 'lastUsed', direction: 'descending' });
	let shown = $state<AdminAccount>();
	let detailsOpen = $state(false);
	let busy = $state(false);
	let confirming = $state<AdminAccountAction | 'delete'>();
	let confirmOpen = $state(false);

	const none = t('common.none');
	const date = (ms: number | undefined) => (ms === undefined ? none : intl.date(ms));
	const type = (account: AdminAccount) =>
		t(account.admin ? 'account.you.typeAdmin' : 'account.you.typeUser');
	const rows = $derived(orderAdminAccounts(accounts ?? [], sort.column, sort.direction));

	const columns = $derived<DataColumn<Column, AdminAccount>[]>([
		{
			id: 'email',
			flush: true,
			label: t('account.you.email'),
			rowHeader: true,
			sortable: true,
			filterKind: 'text',
			// Its filter finds an account by its id as well, as support is asked by id.
			value: (a) => [a.email, a.id]
		},
		{
			id: 'username',
			flush: true,
			label: t('account.you.username'),
			width: '18%',
			sortable: true,
			secondLine: true,
			filterKind: 'text',
			value: (a) => a.username
		},
		{
			id: 'type',
			flush: true,
			label: t('account.admin.typeColumn'),
			width: 'max(9%, 7rem)',
			wide: true,
			sortable: true,
			value: type
		},
		{
			id: 'devices',
			flush: true,
			label: t('account.admin.devicesColumn'),
			width: 'max(9%, 7.5rem)',
			wide: true,
			sortable: true,
			value: (a) => a.devices
		},
		{
			id: 'lastUsed',
			flush: true,
			label: t('account.admin.lastUsed'),
			width: 'max(12%, 8rem)',
			sortable: true,
			secondLine: true,
			value: (a) => a.lastSeenAt
		},
		{
			id: 'since',
			flush: true,
			label: t('account.you.since'),
			width: 'max(12%, 7rem)',
			wide: true,
			sortable: true,
			value: (a) => a.createdAt
		}
	]);

	function onSort(column: Column) {
		sort =
			sort.column === column
				? { column, direction: sort.direction === 'ascending' ? 'descending' : 'ascending' }
				: { column, direction: firstAdminAccountDirection(column) };
	}

	async function load() {
		try {
			accounts = await listAccounts();
		} catch {
			toast(t('account.admin.listFailed'), t('reports.sendFailedDetail'));
		}
	}

	$effect(() => {
		if (me.admin) void load();
	});

	/** The list again, the open account with it. */
	async function refresh() {
		await load();
		if (shown) shown = accounts?.find((a) => a.id === shown?.id);
	}

	function open(account: AdminAccount) {
		shown = account;
		detailsOpen = true;
	}

	/** Puts the account as it is now in the list, or takes it out when it is gone. */
	function replace(id: string, account: AdminAccount | undefined) {
		const rest = (accounts ?? []).filter((a) => a.id !== id);
		accounts = account ? [...rest, account] : rest;
		shown = account;
		if (!account) detailsOpen = false;
	}

	function ask(action: AdminAccountAction | 'delete') {
		confirming = action;
		confirmOpen = true;
	}

	async function confirm() {
		const target = shown;
		const action = confirming;
		if (!target || !action) return;
		busy = true;
		try {
			if (action === 'delete') {
				await deleteAccount(target.id);
				replace(target.id, undefined);
			} else {
				replace(target.id, (await changeAccount(target.id, action)) ?? undefined);
			}
		} catch {
			toast(t('account.admin.actionFailed'), t('reports.sendFailedDetail'));
		} finally {
			busy = false;
		}
	}

	const dialog = $derived.by(() => {
		const email = shown?.email ?? '';
		if (confirming === 'sign-out')
			return {
				title: t('account.admin.signOutTitle'),
				text: t('account.admin.signOutText', { email })
			};
		if (confirming === 'remove-username')
			return {
				title: t('account.admin.removeUsernameTitle'),
				text: t('account.admin.removeUsernameText', { username: shown?.username ?? '' })
			};
		return {
			title: t('account.admin.deleteTitle'),
			text: t('account.admin.deleteText', { email })
		};
	});
</script>

<!-- Refresh is always there, disabled until it applies, so nothing moves when the list appears. -->
<Page title={t('account.admin.title')} iconActions>
	{#snippet actions()}
		<IconButton
			icon="refresh"
			label={t('errors.diag.refresh')}
			disabled={!me.admin || !accounts}
			onclick={refresh}
		/>
	{/snippet}
	{#if me.status === 'checking' || (me.admin && !accounts)}
		<p class="none" aria-busy="true">{t('reports.checking')}</p>
	{:else if !me.admin}
		<div class="none">
			<p>{t('account.admin.adminsOnly')}</p>
			<Button onclick={openAccount}>{t('account.signIn.title')}</Button>
		</div>
	{:else}
		<DataTable
			label={t('account.admin.title')}
			{columns}
			{rows}
			key={(account) => account.id}
			{sort}
			{onSort}
			bind:columnFilters
			narrow="hide"
			fit="container"
			hideKey="admin-accounts"
			pageSize={50}
			empty={none}
			testid="admin-accounts"
		>
			{#snippet cell(account, column)}
				<!-- Every cell opens the same account, so a tap anywhere on the row does; only the
				     email is in the tab order. -->
				<button
					type="button"
					class="open"
					tabindex={column.id === 'email' ? undefined : -1}
					onclick={() => open(account)}
				>
					{#if column.id === 'email'}
						<span class="email">{account.email}</span>
					{:else if column.id === 'username'}
						{account.username ?? none}
					{:else if column.id === 'type'}
						{type(account)}
					{:else if column.id === 'devices'}
						{account.devices}
					{:else if column.id === 'lastUsed'}
						{date(account.lastSeenAt)}
					{:else}
						{date(account.createdAt)}
					{/if}
				</button>
			{/snippet}
		</DataTable>
	{/if}
</Page>

<Dialog bind:open={detailsOpen} title={shown?.email ?? t('account.admin.title')}>
	<!-- Label, value, and what removes it (or nothing), as Account settings. The account is
	     its id, so deleting it sits on that row; the email is the dialog's title. -->
	<dl data-testid="admin-account">
		<dt>{t('account.you.username')}</dt>
		<dd data-testid="admin-account-username">{shown?.username ?? none}</dd>
		<DeleteButton
			label={t('account.admin.removeUsername')}
			onclick={() => ask('remove-username')}
			disabled={busy || !shown?.username}
		/>
		<dt>{t('account.you.type')}</dt>
		<dd>{shown ? type(shown) : none}</dd>
		<span></span>
		<dt>{t('account.you.password')}</dt>
		<dd>{shown?.hasPassword ? t('account.you.passwordSet') : none}</dd>
		<span></span>
		<dt>{t('account.admin.devices')}</dt>
		<dd data-testid="admin-account-devices">{shown ? shown.devices : none}</dd>
		<span></span>
		<dt>{t('account.admin.lastUsed')}</dt>
		<dd>{date(shown?.lastSeenAt)}</dd>
		<span></span>
		<dt>{t('account.you.since')}</dt>
		<dd>{date(shown?.createdAt)}</dd>
		<span></span>
		<dt>{t('account.you.id')}</dt>
		<dd>{shown?.id ?? none}</dd>
		<DeleteButton
			label={t('account.admin.delete')}
			onclick={() => ask('delete')}
			disabled={busy || !shown}
		/>
	</dl>
	<div class="buttons">
		<Button onclick={() => ask('sign-out')} disabled={busy || !shown?.devices}
			>{t('account.admin.signOut')}</Button
		>
	</div>
</Dialog>

<ConfirmDialog
	bind:open={confirmOpen}
	title={dialog.title}
	description={dialog.text}
	danger
	disabled={busy}
	onConfirm={() => void confirm()}
/>

<style>
	/* The whole row opens the account. */
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
	:global([data-testid='admin-accounts'] tr:has(.open:hover)) {
		background: var(--surface-hover);
	}
	.email {
		font-family: var(--font-account);
	}
	dl {
		margin: 0 0 var(--space-3);
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-1) var(--space-3);
	}
	dt {
		color: var(--on-surface-muted);
	}
	/* What people read and type exactly, in the plain account font, as Account settings. */
	dd {
		margin: 0;
		overflow-wrap: anywhere;
		font-family: var(--font-account);
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.none {
		display: grid;
		justify-items: start;
		gap: var(--space-2);
		padding: var(--space-2);
		color: var(--on-surface-muted);
	}
	.none p {
		margin: 0;
	}
</style>

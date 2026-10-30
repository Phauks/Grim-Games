<script lang="ts">
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import { openAccount } from '#lib/features/shell/shell.ts';
	import FriendRows from '#lib/features/friends/FriendRows.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { account as me } from './account.svelte.ts';
	import { changeAccount, deleteAccount, listAccounts } from './admin-accounts-api.ts';
	import {
		adminAccountMatches,
		sortAdminAccounts,
		type AdminAccount,
		type AdminAccountAction
	} from './admin-accounts-protocol.ts';

	// Accounts, at /accounts (plan S27, Trevor 2026-10-30): every account, by email; tapping one
	// opens its details, where an admin acts on it. The Worker decides who may.

	let accounts = $state<AdminAccount[]>([]);
	let filter = $state('');
	let shown = $state<AdminAccount>();
	let detailsOpen = $state(false);
	let busy = $state(false);
	let confirming = $state<AdminAccountAction | 'delete'>();
	let confirmOpen = $state(false);

	const none = t('common.none');
	const date = (ms: number | undefined) => (ms === undefined ? none : intl.date(ms));
	const visible = $derived(accounts.filter((account) => adminAccountMatches(account, filter)));

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

	function open(account: AdminAccount) {
		shown = account;
		detailsOpen = true;
	}

	/** Puts the account as it is now in the list, or takes it out when it is gone. */
	function replace(id: string, account: AdminAccount | undefined) {
		const rest = accounts.filter((a) => a.id !== id);
		accounts = sortAdminAccounts(account ? [...rest, account] : rest);
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

<Page title={t('account.admin.title')}>
	{#if me.status === 'checking'}
		<p class="none" aria-busy="true">{t('reports.checking')}</p>
	{:else if !me.admin}
		<div class="none">
			<p>{t('account.admin.adminsOnly')}</p>
			<Button onclick={openAccount}>{t('account.signIn.title')}</Button>
		</div>
	{:else}
		<div class="filter">
			<SearchField
				label={t('account.admin.filter')}
				placeholder={t('account.admin.filter')}
				bind:value={filter}
				testid="admin-account-filter"
			/>
		</div>
		<FriendRows items={visible} key={(account) => account.id} testid="admin-accounts">
			{#snippet label(account)}
				<button type="button" class="open" onclick={() => open(account)}>
					<span class="email">{account.email}</span>
					<span class="username">{account.username ?? none}</span>
				</button>
			{/snippet}
		</FriendRows>
	{/if}
</Page>

<Dialog bind:open={detailsOpen} title={shown?.email ?? t('account.admin.title')}>
	<!-- Label, value, and what removes it (or nothing), as Account settings. The account is
	     its id, so deleting it sits on that row. -->
	<dl data-testid="admin-account">
		<dt>{t('account.you.email')}</dt>
		<dd data-testid="admin-account-email">{shown?.email ?? none}</dd>
		<span></span>
		<dt>{t('account.you.username')}</dt>
		<dd data-testid="admin-account-username">{shown?.username ?? none}</dd>
		<DeleteButton
			label={t('account.admin.removeUsername')}
			onclick={() => ask('remove-username')}
			disabled={busy || !shown?.username}
		/>
		<dt>{t('account.you.type')}</dt>
		<dd>
			{shown ? t(shown.admin ? 'account.you.typeAdmin' : 'account.you.typeUser') : none}
		</dd>
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
	.filter {
		margin-bottom: var(--space-3);
	}
	/* The whole row opens the account. */
	.open {
		display: grid;
		width: 100%;
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.email {
		font-family: var(--font-account);
	}
	.username {
		color: var(--on-surface-muted);
		font-weight: normal;
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

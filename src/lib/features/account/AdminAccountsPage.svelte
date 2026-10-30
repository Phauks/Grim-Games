<script lang="ts">
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import { openAccount } from '#lib/features/shell/shell.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { account as me } from './account.svelte.ts';
	import { changeAccount, deleteAccount, findAccount } from './admin-accounts-api.ts';
	import type { AdminAccount, AdminAccountAction } from './admin-accounts-protocol.ts';

	// Accounts, at /accounts (plan S27, Trevor 2026-10-30): an admin finds one account by its
	// exact email or username and acts on it. The Worker decides who may; nothing is listed.

	let query = $state('');
	let found = $state<AdminAccount>();
	let busy = $state(false);
	let confirming = $state<AdminAccountAction | 'delete'>();
	let confirmOpen = $state(false);

	const none = t('common.none');
	const date = (ms: number | undefined) => (ms === undefined ? none : intl.date(ms));

	async function find() {
		const wanted = query.trim();
		if (!wanted || busy) return;
		busy = true;
		try {
			found = (await findAccount(wanted)) ?? undefined;
			if (!found) toast(t('account.admin.notFound'));
		} catch {
			found = undefined;
			toast(t('account.admin.findFailed'), t('reports.sendFailedDetail'));
		} finally {
			busy = false;
		}
	}

	function ask(action: AdminAccountAction | 'delete') {
		confirming = action;
		confirmOpen = true;
	}

	async function confirm() {
		const target = found;
		const action = confirming;
		if (!target || !action) return;
		busy = true;
		try {
			if (action === 'delete') {
				await deleteAccount(target.id);
				found = undefined;
			} else {
				found = (await changeAccount(target.id, action)) ?? undefined;
			}
		} catch {
			toast(t('account.admin.actionFailed'), t('reports.sendFailedDetail'));
		} finally {
			busy = false;
		}
	}

	const dialog = $derived.by(() => {
		const email = found?.email ?? '';
		if (confirming === 'sign-out')
			return {
				title: t('account.admin.signOutTitle'),
				text: t('account.admin.signOutText', { email })
			};
		if (confirming === 'remove-username')
			return {
				title: t('account.admin.removeUsernameTitle'),
				text: t('account.admin.removeUsernameText', { username: found?.username ?? '' })
			};
		return {
			title: t('account.admin.deleteTitle'),
			text: t('account.admin.deleteText', { email })
		};
	});
</script>

<!-- Every row and button is always drawn, "None" and disabled until an account is found, so
     nothing moves when one is. -->
<Page title={t('account.admin.title')}>
	{#if me.status === 'checking'}
		<p class="none" aria-busy="true">{t('reports.checking')}</p>
	{:else if !me.admin}
		<div class="none">
			<p>{t('account.admin.adminsOnly')}</p>
			<Button onclick={openAccount}>{t('account.signIn.title')}</Button>
		</div>
	{:else}
		<div class="find">
			<SearchField
				label={t('account.admin.find')}
				placeholder={t('account.admin.find')}
				bind:value={query}
				oncommit={() => void find()}
				testid="admin-account-query"
			/>
			<Button onclick={find} disabled={busy || !query.trim()}
				>{t('account.admin.findButton')}</Button
			>
		</div>
		<!-- Label, value, and what removes it (or nothing), as Account settings. The account is
		     its id, so deleting it sits on that row. -->
		<dl data-testid="admin-account">
			<dt>{t('account.you.email')}</dt>
			<dd data-testid="admin-account-email">{found?.email ?? none}</dd>
			<span></span>
			<dt>{t('account.you.username')}</dt>
			<dd data-testid="admin-account-username">{found?.username ?? none}</dd>
			<DeleteButton
				label={t('account.admin.removeUsername')}
				onclick={() => ask('remove-username')}
				disabled={busy || !found?.username}
			/>
			<dt>{t('account.you.type')}</dt>
			<dd>
				{found ? t(found.admin ? 'account.you.typeAdmin' : 'account.you.typeUser') : none}
			</dd>
			<span></span>
			<dt>{t('account.you.password')}</dt>
			<dd>{found?.hasPassword ? t('account.you.passwordSet') : none}</dd>
			<span></span>
			<dt>{t('account.admin.devices')}</dt>
			<dd data-testid="admin-account-devices">{found ? found.devices : none}</dd>
			<span></span>
			<dt>{t('account.admin.lastUsed')}</dt>
			<dd>{date(found?.lastSeenAt)}</dd>
			<span></span>
			<dt>{t('account.you.since')}</dt>
			<dd>{date(found?.createdAt)}</dd>
			<span></span>
			<dt>{t('account.you.id')}</dt>
			<dd>{found?.id ?? none}</dd>
			<DeleteButton
				label={t('account.admin.delete')}
				onclick={() => ask('delete')}
				disabled={busy || !found}
			/>
		</dl>
		<div class="buttons">
			<Button onclick={() => ask('sign-out')} disabled={busy || !found?.devices}
				>{t('account.admin.signOut')}</Button
			>
		</div>
	{/if}
</Page>

<ConfirmDialog
	bind:open={confirmOpen}
	title={dialog.title}
	description={dialog.text}
	danger
	disabled={busy}
	onConfirm={() => void confirm()}
/>

<style>
	.find {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}
	.find > :global(:first-child) {
		flex: 1 1 15rem;
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

<script lang="ts">
	import { onMount } from 'svelte';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { copyText } from '#lib/ui/clipboard.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { downloadJson } from '#lib/ui/download.ts';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import DataTable, { type DataColumn } from '#lib/ui/table/DataTable.svelte';
	import { accountApi } from './account-api.ts';
	import { account } from './account.svelte.ts';
	import { readSignInHash, type DeviceSession } from './account-protocol.ts';
	import ChangeEmailDialog from './ChangeEmailDialog.svelte';
	import { exportFileName } from './export-file.ts';
	import PasswordDialog from './PasswordDialog.svelte';
	import ProfileIcon from './ProfileIcon.svelte';
	import ProfileIconDialog from './ProfileIconDialog.svelte';
	// Scripts are shown in the Library now, but signing in here still saves the device's
	// scripts to the profile, which this module does when the user changes.
	import './profile-scripts.svelte.ts';
	import SignInForm from './SignInForm.svelte';
	import { startAccount } from './start.ts';
	import UsernameDialog from './UsernameDialog.svelte';

	let linkError = $state('');
	let sessions = $state.raw<DeviceSession[] | undefined>(undefined);
	let sessionsError = $state('');
	let confirmDelete = $state(false);
	/**
	 * Deleting needs the account ID typed out (Trevor, 2026-10-18), ignoring case and spaces
	 * around it; older accounts' long ids can be pasted from the ID row's copy button.
	 */
	let typed = $state('');
	const deletePhrase = $derived(account.user?.id ?? '');
	const deleteTyped = $derived(
		deletePhrase !== '' && typed.trim().toLowerCase() === deletePhrase.toLowerCase()
	);

	type DeviceColumn = 'device' | 'signedIn' | 'lastUsed' | 'signOut';
	const deviceName = (session: DeviceSession) =>
		session.current ? t('account.devices.thisDevice', { device: session.device }) : session.device;
	const deviceColumns = $derived<DataColumn<DeviceColumn, DeviceSession>[]>([
		{
			id: 'device',
			label: t('account.devices.device'),
			rowHeader: true,
			value: deviceName
		},
		{
			id: 'signedIn',
			label: t('account.devices.signedIn'),
			width: 'calc(8 * var(--u))',
			value: (session) => date(session.createdAt)
		},
		{
			id: 'lastUsed',
			label: t('account.devices.lastUsedColumn'),
			width: 'calc(8 * var(--u))',
			value: (session) => date(session.lastSeenAt)
		},
		{
			id: 'signOut',
			label: t('account.signOut'),
			hideLabel: true,
			flush: true,
			fixed: true,
			alwaysShown: true,
			width: 'var(--tap-target)',
			noFilter: "Each row's sign-out button."
		}
	]);
	let editUsername = $state(false);
	let editEmail = $state(false);
	let editPassword = $state(false);
	let editIcon = $state(false);
	let busy = $state(false);

	const date = (ms: number) => intl.date(ms);

	/** A sign-in link: the token is in the hash, which never reaches the server's logs. */
	function openSignInLink(): boolean {
		const link = readSignInHash(location.hash);
		if (!link) return false;
		history.replaceState(history.state, '', location.pathname);
		linkError = '';
		accountApi
			.verifyLink(link.email, link.token)
			.then((info) => {
				account.signedIn(info);
				toast(t('account.signIn.done', { email: link.email }));
			})
			.catch((e) => {
				linkError = t('account.signIn.linkFailed', {
					reason: e instanceof Error ? e.message : String(e)
				});
				void startAccount();
			});
		return true;
	}

	onMount(() => {
		// The root layout already checks the session; a sign-in link replaces that check.
		openSignInLink();
		// The link can also be opened while this page is already showing.
		const onHash = () => void openSignInLink();
		window.addEventListener('hashchange', onHash);
		return () => window.removeEventListener('hashchange', onHash);
	});

	async function loadSessions(): Promise<void> {
		try {
			sessions = await accountApi.sessions();
			sessionsError = '';
		} catch (e) {
			sessionsError = e instanceof Error ? e.message : String(e);
		}
	}

	$effect(() => {
		if (account.status === 'signed-in') void loadSessions();
		else sessions = undefined;
	});

	async function act(action: () => Promise<void>): Promise<void> {
		busy = true;
		try {
			await action();
		} catch (e) {
			toast(t('account.failed'), e instanceof Error ? e.message : String(e));
		} finally {
			busy = false;
		}
	}

	const endSession = (id: string) =>
		act(async () => {
			await accountApi.endSession(id);
			await loadSessions();
		});

	const endOthers = () =>
		act(async () => {
			await accountApi.endOtherSessions();
			await loadSessions();
		});

	const download = () =>
		act(async () => {
			const user = account.user;
			if (!user) return;
			downloadJson(exportFileName(user, new Date()), await accountApi.exportData());
		});

	function askDelete(): void {
		typed = '';
		confirmDelete = true;
	}

	const deleteAccount = () =>
		act(async () => {
			await accountApi.deleteAccount();
			confirmDelete = false;
			account.forget();
			toast(t('account.data.deleted'));
		});
</script>

<!-- Sections side by side on a computer, each at most a reading width (Page `columns`). -->
<Page title={t('account.title')} columns>
	<ErrorBoundary area="account">
		{#if account.status === 'signed-in' && account.user}
			<section class="card" aria-labelledby="you">
				<h2 id="you">{t('account.you.title')}</h2>
				<!-- The account is its own id: the username and email can change at any time. -->
				<dl>
					<dt>{t('account.you.icon')}</dt>
					<dd><span class="icon"><ProfileIcon icon={account.user.icon} /></span></dd>
					<IconButton
						icon="rename"
						label={t('account.icon.title')}
						onclick={() => (editIcon = true)}
						disabled={busy}
					/>
					<dt>{t('account.you.username')}</dt>
					<dd data-testid="account-username">{account.user.username ?? t('common.none')}</dd>
					<IconButton
						icon="rename"
						label={t('account.username.title')}
						onclick={() => (editUsername = true)}
						disabled={busy}
					/>
					<dt>{t('account.you.email')}</dt>
					<dd data-testid="account-email">{account.user.email}</dd>
					<IconButton
						icon="rename"
						label={t('account.changeEmail.title')}
						onclick={() => (editEmail = true)}
						disabled={busy || account.delivery === 'unavailable'}
					/>
					<dt>{t('account.you.password')}</dt>
					<dd data-testid="account-password">
						{account.user.hasPassword ? t('account.you.passwordSet') : t('common.none')}
					</dd>
					<IconButton
						icon="rename"
						label={t('account.password.title')}
						onclick={() => (editPassword = true)}
						disabled={busy}
					/>
					<!-- Set by admins in the reports inbox, not here. -->
					<dt>{t('account.you.type')}</dt>
					<dd class="wide" data-testid="account-type">
						{account.admin ? t('account.you.typeAdmin') : t('account.you.typeUser')}
					</dd>
					<!-- The account's own id: never changes, so it can't be edited. -->
					<dt>{t('account.you.id')}</dt>
					<dd data-testid="account-id">{account.user.id}</dd>
					<IconButton
						icon="copy"
						label={t('account.you.copyId')}
						onclick={() =>
							account.user &&
							copyText(account.user.id, { failed: [t('account.you.copyIdFailed')] })}
					/>
					<dt>{t('account.you.since')}</dt>
					<dd>{date(account.user.createdAt)}</dd>
				</dl>
			</section>

			<PageSection title={t('account.devices.title')}>
				{#snippet aside()}
					<Button
						variant="quiet"
						onclick={endOthers}
						disabled={busy || !sessions || sessions.length < 2}
						>{t('account.devices.signOutOthers')}</Button
					>
				{/snippet}
				{#if sessionsError}
					<p class="muted">{sessionsError}</p>
				{:else if sessions}
					<DataTable
						label={t('account.devices.title')}
						columns={deviceColumns}
						rows={sessions}
						key={(session) => session.id}
						narrow="stack"
						fit="container"
						hideKey="account-devices"
						rowSelected={(session) => session.current}
						testid="devices-table"
					>
						{#snippet cell(session, column)}
							{#if column.id === 'device'}
								{deviceName(session)}
							{:else if column.id === 'signedIn'}
								{date(session.createdAt)}
							{:else if column.id === 'lastUsed'}
								{date(session.lastSeenAt)}
							{:else}
								<DeleteButton
									label={t('account.devices.signOutDevice', { device: deviceName(session) })}
									onclick={() => endSession(session.id)}
									disabled={busy || session.current}
								/>
							{/if}
						{/snippet}
					</DataTable>
				{:else}
					<p class="muted">{t('account.loading')}</p>
				{/if}
			</PageSection>

			<PageSection title={t('account.data.title')}>
				<div class="buttons">
					<Button variant="quiet" onclick={download} disabled={busy}
						>{t('account.data.download')}</Button
					>
				</div>
			</PageSection>

			<!-- Its own section, apart from everything else (Trevor, 2026-10-18). -->
			<PageSection title={t('account.data.delete')}>
				{#snippet aside()}
					<!-- eslint-disable-next-line grim/delete-button -- Trevor 2026-10-18: account deletion is a labelled button, it is so high-impact -->
					<Button variant="danger" icon="remove" onclick={askDelete} disabled={busy}
						>{t('account.data.delete')}</Button
					>
				{/snippet}
			</PageSection>
		{:else}
			<section class="card" aria-labelledby="sign-in">
				<h2 id="sign-in">{t('account.signIn.title')}</h2>
				<p class="muted">{t('account.signIn.intro')}</p>
				{#if account.status === 'checking'}
					<p class="muted">{t('account.signIn.checking')}</p>
				{:else}
					{#if account.status === 'offline'}
						<p class="muted">{t('account.signIn.offline')}</p>
					{/if}
					<SignInForm notice={linkError} />
				{/if}
			</section>
		{/if}
	</ErrorBoundary>
</Page>

<UsernameDialog bind:open={editUsername} />
<ChangeEmailDialog bind:open={editEmail} />
<PasswordDialog bind:open={editPassword} />
<ProfileIconDialog bind:open={editIcon} />

<ConfirmDialog
	bind:open={confirmDelete}
	title={t('account.data.confirmTitle')}
	danger
	disabled={busy || !deleteTyped}
	onConfirm={deleteAccount}
>
	<p>{t('account.data.confirmText')}</p>
	<!-- The phrase on its own line, in plain text: field labels are set in capitals. -->
	<p class="phrase-intro">{t('account.data.typeBelow')}</p>
	<p class="phrase">{deletePhrase}</p>
	<TextField
		plain
		hideLabel
		label={t('account.data.typeToConfirm', { phrase: deletePhrase })}
		bind:value={typed}
		autocomplete="off"
		spellcheck={false}
		disabled={busy}
		oncommit={() => {
			if (!deleteTyped) return false;
			confirmDelete = false;
			void deleteAccount();
		}}
	/>
</ConfirmDialog>

<style>
	h2 {
		margin: 0 0 var(--space-2);
		font-size: var(--section-title-size);
	}
	.card {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
	}
	.card h2 {
		margin: 0;
	}
	/* Label, value, and the value's edit button (or nothing). */
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-1) var(--space-3);
	}
	/* A value with no button after it. */
	dd:last-child,
	dd.wide {
		grid-column: 2 / -1;
	}
	dt,
	.muted {
		color: var(--on-surface-muted);
	}
	/* What people read and type exactly, in the plain account font (Trevor, 2026-10-18). */
	dd,
	.phrase {
		font-family: var(--font-account);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.muted {
		margin: 0;
	}
	.icon {
		display: grid;
		width: var(--tap-target);
		height: var(--tap-target);
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.phrase-intro {
		margin: var(--space-2) 0 0;
	}
	.phrase {
		margin: 0 0 var(--space-2);
		font-weight: bold;
		overflow-wrap: anywhere;
	}
</style>

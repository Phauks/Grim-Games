<script lang="ts">
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import { onMount } from 'svelte';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { copyText } from '#lib/ui/clipboard.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { downloadJson } from '#lib/ui/download.ts';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import { accountApi } from './account-api.ts';
	import { account } from './account.svelte.ts';
	import { readSignInHash, type DeviceSession } from './account-protocol.ts';
	import ChangeEmailDialog from './ChangeEmailDialog.svelte';
	import { exportFileName } from './export-file.ts';
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
	/** Deleting needs the username (or email) typed out (Trevor, 2026-10-18). */
	let typed = $state('');
	const deletePhrase = $derived(account.user?.username ?? account.user?.email ?? '');
	const deleteTyped = $derived(deletePhrase !== '' && typed.trim() === deletePhrase);
	let editUsername = $state(false);
	let editEmail = $state(false);
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

	const signOut = () =>
		act(async () => {
			await account.signOut();
			toast(t('account.signedOut'));
		});

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
				<div class="buttons">
					<Button variant="quiet" onclick={signOut} disabled={busy}>{t('account.signOut')}</Button>
				</div>
			</section>

			<section aria-labelledby="devices">
				<h2 id="devices">{t('account.devices.title')}</h2>
				{#if sessionsError}
					<p class="muted">{sessionsError}</p>
				{:else if sessions}
					<ul class="devices">
						{#each sessions as session (session.id)}
							<li>
								<span>
									{session.current
										? t('account.devices.thisDevice', { device: session.device })
										: session.device}
									<small>{t('account.devices.lastUsed', { date: date(session.lastSeenAt) })}</small>
								</span>
								<Button
									variant="quiet"
									onclick={() => endSession(session.id)}
									disabled={busy || session.current}>{t('account.signOut')}</Button
								>
							</li>
						{/each}
					</ul>
					<div class="buttons">
						<Button variant="quiet" onclick={endOthers} disabled={busy || sessions.length < 2}
							>{t('account.devices.signOutOthers')}</Button
						>
					</div>
				{:else}
					<p class="muted">{t('account.loading')}</p>
				{/if}
			</section>

			<section aria-labelledby="data">
				<h2 id="data">{t('account.data.title')}</h2>
				<div class="buttons start">
					<Button variant="quiet" onclick={download} disabled={busy}
						>{t('account.data.download')}</Button
					>
					<DeleteButton label={t('account.data.delete')} onclick={askDelete} />
				</div>
			</section>
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
	dd:last-child {
		grid-column: 2 / -1;
	}
	dt,
	.muted,
	small {
		color: var(--on-surface-muted);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.muted {
		margin: 0;
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-2);
	}
	.buttons.start {
		justify-content: flex-start;
	}
	.devices {
		list-style: none;
		margin: 0 0 var(--space-2);
		padding: 0;
		display: grid;
		gap: var(--space-1);
	}
	.devices li {
		display: flex;
		align-items: center;
		justify-content: space-between;
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
	.devices small {
		display: block;
	}
</style>

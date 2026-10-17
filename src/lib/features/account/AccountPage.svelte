<script lang="ts">
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import { onMount } from 'svelte';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { accountApi, EXPORT_PATH } from './account-api.ts';
	import { account } from './account.svelte.ts';
	import { readSignInHash, type DeviceSession } from './account-protocol.ts';
	import ProfileScripts from './ProfileScripts.svelte';
	import SignInForm from './SignInForm.svelte';
	import { startAccount } from './start.ts';

	let linkError = $state('');
	let sessions = $state.raw<DeviceSession[] | undefined>(undefined);
	let sessionsError = $state('');
	let confirmDelete = $state(false);
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

	const deleteAccount = () =>
		act(async () => {
			await accountApi.deleteAccount();
			confirmDelete = false;
			account.forget();
			toast(t('account.data.deleted'));
		});
</script>

<main>
	<h1>{t('account.title')}</h1>
	<ErrorBoundary area="account">
		{#if account.status === 'signed-in' && account.user}
			<section class="card" aria-labelledby="you">
				<h2 id="you">{t('account.you.title')}</h2>
				<dl>
					<dt>{t('account.you.email')}</dt>
					<dd data-testid="account-email">{account.user.email}</dd>
					<dt>{t('account.you.since')}</dt>
					<dd>{date(account.user.createdAt)}</dd>
				</dl>
				<div class="buttons">
					<Button variant="quiet" onclick={signOut} disabled={busy}>{t('account.signOut')}</Button>
				</div>
			</section>

			<section aria-labelledby="scripts">
				<h2 id="scripts">{t('account.scripts.title')}</h2>
				<ProfileScripts />
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
					<Button variant="quiet" onclick={() => location.assign(EXPORT_PATH)}
						>{t('account.data.download')}</Button
					>
					<DeleteButton label={t('account.data.delete')} onclick={() => (confirmDelete = true)} />
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
</main>

<ConfirmDialog
	bind:open={confirmDelete}
	title={t('account.data.confirmTitle')}
	danger
	disabled={busy}
	onConfirm={deleteAccount}
>
	<p>{t('account.data.confirmText')}</p>
</ConfirmDialog>

<style>
	/* One column on a phone; on a computer the sections sit side by side, each at most a
	   reading width, instead of one narrow strip down the middle. */
	main {
		max-width: var(--page-max);
		margin: 0 auto;
		padding: var(--space-5) var(--page-gutter);
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--measure)), 1fr));
		align-items: start;
		gap: var(--space-5);
	}
	h1 {
		grid-column: 1 / -1;
		margin: 0;
		font-size: 2rem;
	}
	h2 {
		margin: 0 0 var(--space-2);
		font-size: 1.1rem;
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
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
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
	.devices small {
		display: block;
	}
</style>
